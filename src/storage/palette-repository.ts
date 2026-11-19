import { z } from "zod";
import {
  assetRoleSchema,
  paletteExtractionSchema,
  paletteSizeSchema,
  type ProjectId,
} from "../domain";
import type { AssetId, AssetRevision, AssetRole, PaletteExtraction } from "../domain";
import { database } from "./db";

const storedPaletteSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1).transform((value) => value as ProjectId),
  assetId: z.string().min(1).transform((value) => value as AssetId),
  assetRevision: z.string().min(1).transform((value) => value as AssetRevision),
  sourceRole: assetRoleSchema,
  requestedColors: paletteSizeSchema,
  palette: paletteExtractionSchema,
  savedAt: z.string().datetime(),
}).superRefine((record, context) => {
  if (record.palette.assetId !== record.assetId
    || record.palette.assetRevision !== record.assetRevision
    || record.palette.requestedColors !== record.requestedColors) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["palette"],
      message: "A mentett paletta adatai nem egyeznek a rekord kulcsadataival.",
    });
  }
});

export type StoredPalette = z.infer<typeof storedPaletteSchema>;

export class PaletteRepository {
  async save(
    projectId: ProjectId,
    sourceRole: AssetRole,
    palette: PaletteExtraction,
  ): Promise<void> {
    await database.palettes.put(storedPaletteSchema.parse({
      id: `${projectId}:${palette.id}`,
      projectId,
      assetId: palette.assetId,
      assetRevision: palette.assetRevision,
      sourceRole,
      requestedColors: palette.requestedColors,
      palette,
      savedAt: new Date().toISOString(),
    }));
  }

  async listForProject(projectId: ProjectId): Promise<StoredPalette[]> {
    const records = await database.palettes.where("projectId").equals(projectId).toArray();
    return records.map((record) => storedPaletteSchema.parse(record))
      .sort((first, second) => second.savedAt.localeCompare(first.savedAt));
  }

  async deleteForAssets(assetIds: string[]): Promise<void> {
    if (assetIds.length === 0) return;
    await database.palettes.where("assetId").anyOf(assetIds).delete();
  }
}

export const paletteRepository = new PaletteRepository();
