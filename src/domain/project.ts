import { z } from "zod";
import type { AssetId, AssetRevision, ProjectId } from "./ids";
import { paletteSizeSchema } from "./palette";

export const projectSchemaVersion = 3 as const;

export const storageModeSchema = z.enum(["filesystem", "indexeddb"]);
export type StorageMode = z.infer<typeof storageModeSchema>;

export const compositionAspectSchema = z.enum(["free", "1:1", "3:2", "4:3", "16:9", "2:3", "custom"]);
export type CompositionAspect = z.infer<typeof compositionAspectSchema>;

export const gridModeSchema = z.enum([
  "thirds",
  "quarters",
  "6x6",
  "8x8",
  "10x10",
  "custom",
  "metric",
  "diagonals",
  "none",
]);
export type GridMode = z.infer<typeof gridModeSchema>;

export const compositionPlanSchema = z.object({
  aspect: compositionAspectSchema,
  widthCm: z.number().positive().nullable(),
  heightCm: z.number().positive().nullable(),
  grid: z.object({
    mode: gridModeSchema,
    columns: z.number().int().min(1).max(100),
    rows: z.number().int().min(1).max(100),
    cellCm: z.number().positive().nullable(),
  }),
});
export type CompositionPlan = z.infer<typeof compositionPlanSchema>;

export const defaultCompositionPlan: CompositionPlan = {
  aspect: "free",
  widthCm: null,
  heightCm: null,
  grid: {
    mode: "thirds",
    columns: 10,
    rows: 6,
    cellCm: 4,
  },
};

export const assetRoleSchema = z.enum(["reference", "artwork"]);
export type AssetRole = z.infer<typeof assetRoleSchema>;

export const paintAmountUnitSchema = z.enum(["g", "ml"]);
export type PaintAmountUnit = z.infer<typeof paintAmountUnitSchema>;

export const projectWorkspaceSchema = z.object({
  palette: z.object({
    sourceRole: assetRoleSchema,
    requestedColors: paletteSizeSchema,
    showContours: z.boolean(),
  }),
  paint: z.object({
    totalAmount: z.string().max(40),
    unit: paintAmountUnitSchema,
    draft: z.object({
      manufacturer: z.string().max(100),
      name: z.string().max(100),
      pigmentCode: z.string().max(64),
      hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    }),
    editingPaintId: z.string().nullable(),
  }),
});
export type ProjectWorkspace = z.infer<typeof projectWorkspaceSchema>;

export const defaultProjectWorkspace: ProjectWorkspace = {
  palette: {
    sourceRole: "reference",
    requestedColors: 6,
    showContours: true,
  },
  paint: {
    totalAmount: "",
    unit: "g",
    draft: {
      manufacturer: "",
      name: "",
      pigmentCode: "",
      hex: "#808080",
    },
    editingPaintId: null,
  },
};

export const projectSchema = z.object({
  id: z.string().min(1).transform((value) => value as ProjectId),
  schemaVersion: z.literal(projectSchemaVersion),
  name: z.string().trim().min(1).max(120),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  composition: compositionPlanSchema,
  workspace: projectWorkspaceSchema,
  storage: z.object({
    mode: storageModeSchema,
    rootKey: z.string().min(1).optional(),
  }),
});
export type Project = z.infer<typeof projectSchema>;

export const projectAssetSchema = z.object({
  id: z.string().min(1).transform((value) => value as AssetId),
  projectId: z.string().min(1).transform((value) => value as ProjectId),
  role: assetRoleSchema,
  fileName: z.string().min(1).max(255),
  relativePath: z.string().min(1).max(1024),
  mimeType: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  lastModified: z.number().nonnegative(),
  storageMode: storageModeSchema,
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  contentHash: z.string().min(1).optional(),
});
export type ProjectAsset = z.infer<typeof projectAssetSchema>;

export const imageAnalysisSchema = z.object({
  id: z.string().min(1),
  assetId: z.string().min(1).transform((value) => value as AssetId),
  assetRevision: z.string().min(1).transform((value) => value as AssetRevision),
  analysisVersion: z.literal(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  aspectRatio: z.number().positive(),
  tone: z.object({
    mean: z.number().min(0).max(255),
    bins: z.tuple([
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
      z.number().int().nonnegative(),
    ]),
    sampleCount: z.number().int().positive(),
  }),
  createdAt: z.string().datetime(),
});
export type ImageAnalysis = z.infer<typeof imageAnalysisSchema>;
