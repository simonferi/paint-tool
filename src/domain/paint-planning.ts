import { z } from "zod";
import type { ProjectId } from "./ids";
import {
  deltaE2000,
  hexFromReflectance,
  labFromReflectance,
  labFromSrgbHex,
  mixInfiniteLayerReflectance,
  paintOpticalDataSchema,
} from "./spectral-colorimetry";
import type { PaintAmountUnit } from "./project";

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/).transform((hex) => hex.toUpperCase());

export const paintColorSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(2),
  projectId: z.string().min(1).transform((value) => value as ProjectId),
  manufacturer: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  pigmentCode: z.string().trim().max(64),
  hex: hexColorSchema,
  opticalData: paintOpticalDataSchema.optional(),
  densityGPerMl: z.number().finite().positive().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type PaintColor = z.infer<typeof paintColorSchema>;

export const paintMixNoteSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.literal(1),
  projectId: z.string().min(1).transform((value) => value as ProjectId),
  targetHex: hexColorSchema,
  note: z.string().trim().max(500),
  updatedAt: z.string().datetime(),
});
export type PaintMixNote = z.infer<typeof paintMixNoteSchema>;

export type PaintMixComponent = {
  paint: PaintColor;
  fraction: number;
};

type PaintMixSuggestionBase = {
  targetHex: string;
  components: PaintMixComponent[];
  estimatedHex: string;
};

export type PaintMixSuggestion = PaintMixSuggestionBase & (
  | {
    model: "rgb-linear-v1";
    rgbDistance: number;
    deltaE2000?: never;
  }
  | {
    model: "kubelka-munk-single-constant-v1";
    deltaE2000: number;
    rgbDistance?: never;
  }
);

export type PalettePaintEstimate = {
  number: number;
  hex: string;
  areaPercent: number;
  quantity: number;
};

export type PaintDemandEstimate = {
  paint: PaintColor;
  quantity: number;
  percentOfTotal: number;
};

export type PaintConsumptionEstimate = {
  paletteRows: PalettePaintEstimate[];
  paintRows: PaintDemandEstimate[];
  unmatchedPaletteNumbers: number[];
  missingDensityPaletteNumbers: number[];
};

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hexColorSchema.parse(hex);
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function squaredDistance(first: readonly number[], second: readonly number[]): number {
  return first.reduce((sum, channel, index) => sum + (channel - second[index]) ** 2, 0);
}

function comparePaints(first: PaintColor, second: PaintColor): number {
  return first.manufacturer.localeCompare(second.manufacturer, "hu")
    || first.name.localeCompare(second.name, "hu")
    || first.id.localeCompare(second.id);
}

export function suggestPaintMix(targetHex: string, inventory: PaintColor[]): PaintMixSuggestion | null {
  const target = hexToRgb(targetHex);
  const paints = [...inventory].sort(comparePaints);
  if (paints.length === 0) return null;

  type Candidate = { components: PaintMixComponent[]; rgb: number[]; error: number };
  let best: Candidate | null = null;
  const consider = (
    currentBest: Candidate | null,
    components: PaintMixComponent[],
    rgb: number[],
  ): Candidate => {
    const error = squaredDistance(target, rgb);
    return !currentBest || error < currentBest.error - 1e-9
      ? { components, rgb, error }
      : currentBest;
  };

  const paintColors = paints.map((paint) => ({ paint, rgb: hexToRgb(paint.hex) }));
  for (const { paint, rgb } of paintColors) {
    best = consider(best, [{ paint, fraction: 1 }], rgb);
  }

  for (let firstIndex = 0; firstIndex < paintColors.length; firstIndex += 1) {
    const first = paintColors[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < paintColors.length; secondIndex += 1) {
      const second = paintColors[secondIndex];
      const direction = first.rgb.map((channel, index) => second.rgb[index] - channel);
      const lengthSquared = squaredDistance(direction, [0, 0, 0]);
      if (lengthSquared === 0) continue;

      const targetOffset = target.map((channel, index) => channel - first.rgb[index]);
      const secondFraction = Math.max(0, Math.min(1,
        targetOffset.reduce((sum, channel, index) => sum + channel * direction[index], 0) / lengthSquared,
      ));
      if (secondFraction <= 1e-9 || secondFraction >= 1 - 1e-9) continue;

      const firstFraction = 1 - secondFraction;
      const rgb = first.rgb.map((channel, index) => channel * firstFraction + second.rgb[index] * secondFraction);
      best = consider(best, [
        { paint: first.paint, fraction: firstFraction },
        { paint: second.paint, fraction: secondFraction },
      ], rgb);
    }
  }

  if (!best) return null;
  return {
    targetHex: hexColorSchema.parse(targetHex),
    components: best.components,
    estimatedHex: rgbToHex(best.rgb[0], best.rgb[1], best.rgb[2]),
    model: "rgb-linear-v1",
    rgbDistance: Math.sqrt(best.error),
  };
}

export function suggestKubelkaMunkMix(
  targetHex: string,
  inventory: PaintColor[],
): PaintMixSuggestion | null {
  const target = labFromSrgbHex(hexColorSchema.parse(targetHex));
  type OpticalPaint = PaintColor & {
    opticalData: NonNullable<PaintColor["opticalData"]>;
  };
  type OpticalPaintMixComponent = { paint: OpticalPaint; fraction: number };
  const paints = [...inventory]
    .filter((paint): paint is OpticalPaint => paint.opticalData !== undefined)
    .sort(comparePaints);
  if (paints.length === 0) return null;

  type Candidate = {
    components: OpticalPaintMixComponent[];
    reflectance: number[];
    error: number;
  };
  const best: { candidate: Candidate | null } = { candidate: null };
  const consider = (components: OpticalPaintMixComponent[]): Candidate => {
    const reflectance = mixInfiniteLayerReflectance(components.map(({ paint, fraction }) => ({
      reflectance: paint.opticalData.reflectance,
      massFraction: fraction,
    })));
    const error = deltaE2000(target, labFromReflectance(reflectance));
    const candidate = { components, reflectance, error };
    if (!best.candidate || error < best.candidate.error - 1e-9) best.candidate = candidate;
    return candidate;
  };

  for (const paint of paints) {
    consider([{ paint, fraction: 1 }]);
  }

  const evaluatePair = (
    first: OpticalPaint,
    second: OpticalPaint,
    secondFraction: number,
  ) => consider([
    { paint: first, fraction: 1 - secondFraction },
    { paint: second, fraction: secondFraction },
  ]);
  for (let firstIndex = 0; firstIndex < paints.length; firstIndex += 1) {
    const first = paints[firstIndex];
    for (let secondIndex = firstIndex + 1; secondIndex < paints.length; secondIndex += 1) {
      const second = paints[secondIndex];
      let coarseBestFraction = 0;
      let coarseBestError = Number.POSITIVE_INFINITY;
      for (let step = 1; step < 50; step += 1) {
        const fraction = step / 50;
        const candidate = evaluatePair(first, second, fraction);
        if (candidate.error < coarseBestError) {
          coarseBestError = candidate.error;
          coarseBestFraction = fraction;
        }
      }

      let low = Math.max(0, coarseBestFraction - 0.02);
      let high = Math.min(1, coarseBestFraction + 0.02);
      const goldenRatio = (Math.sqrt(5) - 1) / 2;
      let left = high - goldenRatio * (high - low);
      let right = low + goldenRatio * (high - low);
      let leftError = evaluatePair(first, second, left).error;
      let rightError = evaluatePair(first, second, right).error;
      for (let iteration = 0; iteration < 18; iteration += 1) {
        if (leftError <= rightError) {
          high = right;
          right = left;
          rightError = leftError;
          left = high - goldenRatio * (high - low);
          leftError = evaluatePair(first, second, left).error;
        } else {
          low = left;
          left = right;
          leftError = rightError;
          right = low + goldenRatio * (high - low);
          rightError = evaluatePair(first, second, right).error;
        }
      }
      evaluatePair(first, second, (low + high) / 2);
    }
  }

  const candidate = best.candidate;
  if (!candidate) return null;
  return {
    targetHex: hexColorSchema.parse(targetHex),
    components: candidate.components,
    estimatedHex: hexFromReflectance(candidate.reflectance),
    model: "kubelka-munk-single-constant-v1",
    deltaE2000: candidate.error,
  };
}

export function calculatePaintConsumption(
  colors: Array<{ number: number; hex: string; pixelCount: number }>,
  totalAmount: number,
  suggestions: Array<PaintMixSuggestion | null>,
  unit: PaintAmountUnit = "g",
): PaintConsumptionEstimate {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error("A teljes festékmennyiségnek véges, nullánál nagyobb számnak kell lennie.");
  }

  const totalPixels = colors.reduce((sum, color) => sum + color.pixelCount, 0);
  if (colors.length === 0 || !Number.isFinite(totalPixels) || totalPixels <= 0) {
    throw new Error("A fogyasztás becsléséhez érvényes paletta szükséges.");
  }

  const paletteRows = colors.map((color) => ({
    number: color.number,
    hex: hexColorSchema.parse(color.hex),
    areaPercent: (color.pixelCount / totalPixels) * 100,
    quantity: totalAmount * color.pixelCount / totalPixels,
  })).sort((first, second) =>
    second.areaPercent - first.areaPercent || first.number - second.number,
  );
  const suggestionsByHex = new Map(
    suggestions.filter((suggestion): suggestion is PaintMixSuggestion => suggestion !== null)
      .map((suggestion) => [hexColorSchema.parse(suggestion.targetHex), suggestion]),
  );
  const paintTotals = new Map<string, { paint: PaintColor; quantity: number }>();
  const unmatchedPaletteNumbers: number[] = [];
  const missingDensityPaletteNumbers: number[] = [];

  for (const row of paletteRows) {
    const suggestion = suggestionsByHex.get(row.hex);
    if (!suggestion) {
      unmatchedPaletteNumbers.push(row.number);
      continue;
    }
    let fractions = suggestion.components.map(({ fraction }) => fraction);
    if (suggestion.model === "kubelka-munk-single-constant-v1" && unit === "ml") {
      if (suggestion.components.some(({ paint }) => paint.densityGPerMl === undefined)) {
        missingDensityPaletteNumbers.push(row.number);
        continue;
      }
      const volumeParts = suggestion.components.map(({ paint, fraction }) =>
        fraction / paint.densityGPerMl!,
      );
      const totalVolumeParts = volumeParts.reduce((sum, value) => sum + value, 0);
      fractions = volumeParts.map((value) => value / totalVolumeParts);
    }
    for (const [index, component] of suggestion.components.entries()) {
      const previous = paintTotals.get(component.paint.id);
      paintTotals.set(component.paint.id, {
        paint: component.paint,
        quantity: (previous?.quantity ?? 0) + row.quantity * fractions[index],
      });
    }
  }

  const paintRows = [...paintTotals.values()]
    .map(({ paint, quantity }) => ({
      paint,
      quantity,
      percentOfTotal: (quantity / totalAmount) * 100,
    }))
    .sort((first, second) =>
      second.quantity - first.quantity
      || comparePaints(first.paint, second.paint),
    );

  return { paletteRows, paintRows, unmatchedPaletteNumbers, missingDensityPaletteNumbers };
}
