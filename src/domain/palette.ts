import { z } from "zod";
import type { AssetId, AssetRevision } from "./ids";

export const paletteSizeSchema = z.union([
  z.literal(4),
  z.literal(5),
  z.literal(6),
  z.literal(8),
  z.literal(10),
]);
export type PaletteSize = z.infer<typeof paletteSizeSchema>;

const paletteColorSchema = z.object({
  number: z.number().int().min(1).max(10),
  hex: z.string().regex(/^#[0-9A-F]{6}$/),
  red: z.number().int().min(0).max(255),
  green: z.number().int().min(0).max(255),
  blue: z.number().int().min(0).max(255),
  pixelCount: z.number().int().positive(),
  marker: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
  }),
});

export const paletteExtractionSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1).transform((value) => value as AssetId),
  assetRevision: z.string().min(1).transform((value) => value as AssetRevision),
  activeAreaKey: z.string().min(1).default("full"),
  paletteVersion: z.literal(1),
  requestedColors: paletteSizeSchema,
  width: z.number().int().positive().max(1000),
  height: z.number().int().positive().max(1000),
  colors: z.array(paletteColorSchema).min(1).max(10),
  labelMap: z.custom<Uint8Array>((value) => value instanceof Uint8Array),
  sourcePixels: z.custom<Uint8ClampedArray>((value) => value instanceof Uint8ClampedArray),
}).superRefine((palette, context) => {
  const pixelCount = palette.width * palette.height;
  if (palette.labelMap.length !== pixelCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["labelMap"],
      message: "A színtérkép képmérete nem egyezik az indexek számával.",
    });
  }
  if (palette.sourcePixels.length !== pixelCount * 4) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["sourcePixels"],
      message: "A forrásképpontok száma nem egyezik a térkép méretével.",
    });
  }
  if (palette.colors.length > palette.requestedColors) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["colors"],
      message: "A tényleges paletta nagyobb a kért színszámnál.",
    });
  }
  if (palette.colors.some((color, index) => color.number !== index + 1)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["colors"],
      message: "A palettaszámoknak egytől kell kezdődniük és folytonosnak kell lenniük.",
    });
  }
  if (palette.colors.reduce((sum, color) => sum + color.pixelCount, 0) !== pixelCount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["colors"],
      message: "A paletta képpontszámainak összege nem egyezik a térkép méretével.",
    });
  }
});

export type PaletteExtraction = z.infer<typeof paletteExtractionSchema>;
