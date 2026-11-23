import { z } from "zod";

export const paintReflectanceSchema = z.array(
  z.number().finite().gt(0).max(1),
).length(41);

export const paintOpticalDataSchema = z.object({
  schemaVersion: z.literal(1),
  provenance: z.enum(["measured", "manufacturer", "estimated"]),
  source: z.string().trim().min(1).max(300),
  wavelengthStartNm: z.literal(380),
  wavelengthIntervalNm: z.literal(10),
  measurementCondition: z.literal("diffuse-infinite-layer"),
  reflectance: paintReflectanceSchema,
});
export type PaintOpticalData = z.infer<typeof paintOpticalDataSchema>;

export type CieLab = readonly [lightness: number, a: number, b: number];

// CIE 1931 2° observer and D65 data sampled at 10 nm from Colour's BSD-3-Clause datasets.
const spectralSamples = [
  [0.001368, 0.000039, 0.006450001, 49.9755],
  [0.004243, 0.00012, 0.02005001, 54.6482],
  [0.01431, 0.000396, 0.06785001, 82.7549],
  [0.04351, 0.00121, 0.2074, 91.486],
  [0.13438, 0.004, 0.6456, 93.4318],
  [0.2839, 0.0116, 1.3856, 86.6823],
  [0.34828, 0.023, 1.74706, 104.865],
  [0.3362, 0.038, 1.77211, 117.008],
  [0.2908, 0.06, 1.6692, 117.812],
  [0.19536, 0.09098, 1.28764, 114.861],
  [0.09564, 0.13902, 0.8129501, 115.923],
  [0.03201, 0.20802, 0.46518, 108.811],
  [0.0049, 0.323, 0.272, 109.354],
  [0.0093, 0.503, 0.1582, 107.802],
  [0.06327, 0.71, 0.07824999, 104.79],
  [0.1655, 0.862, 0.04216, 107.689],
  [0.2904, 0.954, 0.0203, 104.405],
  [0.4334499, 0.9949501, 0.008749999, 104.046],
  [0.5945, 0.995, 0.0039, 100],
  [0.7621, 0.952, 0.0021, 96.3342],
  [0.9163, 0.87, 0.001650001, 95.788],
  [1.0263, 0.757, 0.0011, 88.6856],
  [1.0622, 0.631, 0.0008, 90.0062],
  [1.0026, 0.503, 0.00034, 89.5991],
  [0.8544499, 0.381, 0.00019, 87.6987],
  [0.6424, 0.265, 0.00004999999, 83.2886],
  [0.4479, 0.175, 0.00002, 83.6992],
  [0.2835, 0.107, 0, 80.0268],
  [0.1649, 0.061, 0, 80.2146],
  [0.0874, 0.032, 0, 82.2778],
  [0.04677, 0.017, 0, 78.2842],
  [0.0227, 0.00821, 0, 69.7213],
  [0.01135916, 0.004102, 0, 71.6091],
  [0.005790346, 0.002091, 0, 74.349],
  [0.002899327, 0.001047, 0, 61.604],
  [0.001439971, 0.00052, 0, 69.8856],
  [0.0006900786, 0.0002492, 0, 75.087],
  [0.0003323011, 0.00012, 0, 63.5927],
  [0.0001661505, 0.00006, 0, 46.4182],
  [0.00008307527, 0.00003, 0, 66.8054],
  [0.00004150994, 0.00001499, 0, 63.3828],
] as const;

const integrationWeights = spectralSamples.map(([x, y, z, illuminant], index) => {
  const intervalWeight = index === 0 || index === spectralSamples.length - 1 ? 0.5 : 1;
  return [x * illuminant * intervalWeight, y * illuminant * intervalWeight, z * illuminant * intervalWeight] as const;
});
const yNormalization = 1 / integrationWeights.reduce((sum, [, y]) => sum + y, 0);

function integrateReflectance(reflectance: readonly number[]): [number, number, number] {
  const samples = paintReflectanceSchema.parse(reflectance);
  const xyz = integrationWeights.reduce<[number, number, number]>(
    ([xSum, ySum, zSum], [xWeight, yWeight, zWeight], index) => [
      xSum + xWeight * samples[index],
      ySum + yWeight * samples[index],
      zSum + zWeight * samples[index],
    ],
    [0, 0, 0],
  );
  return xyz.map((value) => value * yNormalization) as [number, number, number];
}

const d65White = integrateReflectance(Array<number>(41).fill(1));

function xyzToLab([x, y, z]: readonly [number, number, number]): [number, number, number] {
  const [whiteX, whiteY, whiteZ] = d65White;
  const delta = 6 / 29;
  const curve = (value: number) => value > delta ** 3
    ? Math.cbrt(value)
    : value / (3 * delta ** 2) + 4 / 29;
  const fx = curve(x / whiteX);
  const fy = curve(y / whiteY);
  const fz = curve(z / whiteZ);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function decodeSrgbChannel(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function hexToXyz(hex: string): [number, number, number] {
  if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
    throw new Error("A cél színe érvénytelen HEX érték.");
  }
  const red = decodeSrgbChannel(Number.parseInt(hex.slice(1, 3), 16));
  const green = decodeSrgbChannel(Number.parseInt(hex.slice(3, 5), 16));
  const blue = decodeSrgbChannel(Number.parseInt(hex.slice(5, 7), 16));
  return [
    0.4124564 * red + 0.3575761 * green + 0.1804375 * blue,
    0.2126729 * red + 0.7151522 * green + 0.072175 * blue,
    0.0193339 * red + 0.119192 * green + 0.9503041 * blue,
  ];
}

function encodeSrgbChannel(channel: number): number {
  const bounded = Math.max(0, Math.min(1, channel));
  const encoded = bounded <= 0.0031308
    ? 12.92 * bounded
    : 1.055 * bounded ** (1 / 2.4) - 0.055;
  return Math.round(encoded * 255);
}

function xyzToHex([x, y, z]: readonly [number, number, number]): string {
  const red = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
  const green = -0.969266 * x + 1.8760108 * y + 0.041556 * z;
  const blue = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
  return `#${[red, green, blue]
    .map(encodeSrgbChannel)
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

export function kubelkaMunkFunction(reflectance: number): number {
  const sample = paintReflectanceSchema.element.parse(reflectance);
  return ((1 - sample) ** 2) / (2 * sample);
}

export function mixInfiniteLayerReflectance(
  components: ReadonlyArray<{ reflectance: readonly number[]; massFraction: number }>,
): number[] {
  const totalFraction = components.reduce((sum, component) => {
    if (!Number.isFinite(component.massFraction) || component.massFraction < 0) {
      throw new Error("A festék tömegarányának véges, nem negatív számnak kell lennie.");
    }
    return sum + component.massFraction;
  }, 0);
  if (components.length === 0 || totalFraction <= 0) {
    throw new Error("A fizikai keveréshez pozitív tömegarányú festék szükséges.");
  }

  const reflectances = components.map((component) => paintReflectanceSchema.parse(component.reflectance));
  return Array.from({ length: 41 }, (_, index) => {
    const mixedKs = components.reduce((sum, component, componentIndex) =>
      sum + (component.massFraction / totalFraction)
        * kubelkaMunkFunction(reflectances[componentIndex][index]),
    0);
    return 1 / (1 + mixedKs + Math.sqrt(mixedKs * (mixedKs + 2)));
  });
}

export function labFromReflectance(reflectance: readonly number[]): [number, number, number] {
  return xyzToLab(integrateReflectance(reflectance));
}

export function labFromSrgbHex(hex: string): [number, number, number] {
  return xyzToLab(hexToXyz(hex));
}

export function hexFromReflectance(reflectance: readonly number[]): string {
  return xyzToHex(integrateReflectance(reflectance));
}

function hueAngle(a: number, b: number): number {
  const degrees = Math.atan2(b, a) * 180 / Math.PI;
  return degrees < 0 ? degrees + 360 : degrees;
}

function cosineDegrees(degrees: number): number {
  return Math.cos(degrees * Math.PI / 180);
}

export function deltaE2000(first: CieLab, second: CieLab): number {
  const [lightness1, a1, b1] = first;
  const [lightness2, a2, b2] = second;
  const chroma1 = Math.hypot(a1, b1);
  const chroma2 = Math.hypot(a2, b2);
  const averageChroma = (chroma1 + chroma2) / 2;
  const averageChroma7 = averageChroma ** 7;
  const g = 0.5 * (1 - Math.sqrt(averageChroma7 / (averageChroma7 + 25 ** 7)));
  const adjustedA1 = (1 + g) * a1;
  const adjustedA2 = (1 + g) * a2;
  const adjustedChroma1 = Math.hypot(adjustedA1, b1);
  const adjustedChroma2 = Math.hypot(adjustedA2, b2);
  const hue1 = adjustedChroma1 === 0 ? 0 : hueAngle(adjustedA1, b1);
  const hue2 = adjustedChroma2 === 0 ? 0 : hueAngle(adjustedA2, b2);
  const deltaLightness = lightness2 - lightness1;
  const deltaChroma = adjustedChroma2 - adjustedChroma1;
  let deltaHueAngle = hue2 - hue1;
  if (adjustedChroma1 * adjustedChroma2 === 0) {
    deltaHueAngle = 0;
  } else if (deltaHueAngle > 180) {
    deltaHueAngle -= 360;
  } else if (deltaHueAngle < -180) {
    deltaHueAngle += 360;
  }
  const deltaHue = 2 * Math.sqrt(adjustedChroma1 * adjustedChroma2)
    * Math.sin(deltaHueAngle * Math.PI / 360);
  const averageLightness = (lightness1 + lightness2) / 2;
  const averageAdjustedChroma = (adjustedChroma1 + adjustedChroma2) / 2;
  let averageHue = hue1 + hue2;
  if (adjustedChroma1 * adjustedChroma2 === 0) {
    averageHue = hue1 + hue2;
  } else if (Math.abs(hue1 - hue2) <= 180) {
    averageHue /= 2;
  } else if (hue1 + hue2 < 360) {
    averageHue = (hue1 + hue2 + 360) / 2;
  } else {
    averageHue = (hue1 + hue2 - 360) / 2;
  }

  const t = 1
    - 0.17 * cosineDegrees(averageHue - 30)
    + 0.24 * cosineDegrees(2 * averageHue)
    + 0.32 * cosineDegrees(3 * averageHue + 6)
    - 0.2 * cosineDegrees(4 * averageHue - 63);
  const deltaTheta = 30 * Math.exp(-(((averageHue - 275) / 25) ** 2));
  const averageChroma7Adjusted = averageAdjustedChroma ** 7;
  const rotation = -2 * Math.sqrt(
    averageChroma7Adjusted / (averageChroma7Adjusted + 25 ** 7),
  ) * Math.sin(2 * deltaTheta * Math.PI / 180);
  const lightnessScale = 1 + (0.015 * (averageLightness - 50) ** 2)
    / Math.sqrt(20 + (averageLightness - 50) ** 2);
  const chromaScale = 1 + 0.045 * averageAdjustedChroma;
  const hueScale = 1 + 0.015 * averageAdjustedChroma * t;
  const scaledLightness = deltaLightness / lightnessScale;
  const scaledChroma = deltaChroma / chromaScale;
  const scaledHue = deltaHue / hueScale;
  return Math.sqrt(
    scaledLightness ** 2
    + scaledChroma ** 2
    + scaledHue ** 2
    + rotation * scaledChroma * scaledHue,
  );
}
