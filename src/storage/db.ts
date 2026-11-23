import Dexie, { type Table } from "dexie";
import {
  defaultCompositionPlan,
  defaultProjectWorkspace,
  type ImageAnalysis,
  type PaletteExtraction,
  type PaintColor,
  type PaintMixNote,
  type Project,
  type ProjectAsset,
  type ProjectId,
  projectSchemaVersion,
  type ProjectWorkspace,
} from "../domain";
import type { DirectoryHandleLike } from "./filesystem-types";

export type FallbackBlobRecord = {
  assetId: ProjectAsset["id"];
  blob: Blob;
  savedAt: string;
};

export type StorageBindingRecord = {
  projectId: ProjectId;
  rootKey: string;
  rootHandle: DirectoryHandleLike;
  createdAt: string;
};

type MigratingProjectRecord = {
  schemaVersion?: number;
  composition?: Partial<Project["composition"]>;
  workspace?: {
    palette?: ProjectWorkspace["palette"];
    paint?: Partial<ProjectWorkspace["paint"]> & {
      draft?: Partial<ProjectWorkspace["paint"]["draft"]>;
    };
  };
};

type MigratingPaintColorRecord = {
  schemaVersion?: number;
};

export class PaintToolDatabase extends Dexie {
  projects!: Table<Project, ProjectId>;
  assets!: Table<ProjectAsset, ProjectAsset["id"]>;
  analyses!: Table<ImageAnalysis, string>;
  fallbackBlobs!: Table<FallbackBlobRecord, ProjectAsset["id"]>;
  storageBindings!: Table<StorageBindingRecord, ProjectId>;
  palettes!: Table<StoredPaletteRecord, string>;
  paintColors!: Table<PaintColor, string>;
  paintMixNotes!: Table<PaintMixNote, string>;

  constructor() {
    super("vonal-es-tonus");
    this.version(1).stores({
      projects: "id, updatedAt",
      assets: "id, projectId, [projectId+role]",
      analyses: "id, assetId, [assetId+assetRevision+analysisVersion]",
      fallbackBlobs: "assetId",
      storageBindings: "projectId, rootKey",
    });
    this.version(2)
      .stores({
        projects: "id, updatedAt",
        assets: "id, projectId, [projectId+role]",
        analyses: "id, assetId, [assetId+assetRevision+analysisVersion]",
        fallbackBlobs: "assetId",
        storageBindings: "projectId, rootKey",
      })
      .upgrade(async (transaction) => {
        await transaction.table("projects").toCollection().modify((project: MigratingProjectRecord) => {
          project.schemaVersion = 2;
          project.composition ??= structuredClone(defaultCompositionPlan);
        });
      });
    this.version(3).stores({
      projects: "id, updatedAt",
      assets: "id, projectId, [projectId+role]",
      analyses: "id, assetId, [assetId+assetRevision+analysisVersion]",
      fallbackBlobs: "assetId",
      storageBindings: "projectId, rootKey",
      paintColors: "id, projectId, manufacturer, name",
      paintMixNotes: "id, projectId, [projectId+targetHex]",
    });
    this.version(4).stores({
      projects: "id, updatedAt",
      assets: "id, projectId, [projectId+role]",
      analyses: "id, assetId, [assetId+assetRevision+analysisVersion]",
      fallbackBlobs: "assetId",
      storageBindings: "projectId, rootKey",
      paintColors: "id, projectId, manufacturer, name",
      paintMixNotes: "id, projectId, [projectId+targetHex]",
      palettes: "id, projectId, assetId, [projectId+savedAt]",
    });
    this.version(5).stores({
      projects: "id, updatedAt",
      assets: "id, projectId, [projectId+role]",
      analyses: "id, assetId, [assetId+assetRevision+analysisVersion]",
      fallbackBlobs: "assetId",
      storageBindings: "projectId, rootKey",
      paintColors: "id, projectId, manufacturer, name",
      paintMixNotes: "id, projectId, [projectId+targetHex]",
      palettes: "id, projectId, assetId, [projectId+savedAt]",
    }).upgrade(async (transaction) => {
      await transaction.table("projects").toCollection().modify((project: MigratingProjectRecord) => {
        project.schemaVersion = 3;
        project.workspace ??= structuredClone(defaultProjectWorkspace);
      });
    });
    this.version(6).stores({
      projects: "id, updatedAt",
      assets: "id, projectId, [projectId+role]",
      analyses: "id, assetId, [assetId+assetRevision+analysisVersion]",
      fallbackBlobs: "assetId",
      storageBindings: "projectId, rootKey",
      paintColors: "id, projectId, manufacturer, name",
      paintMixNotes: "id, projectId, [projectId+targetHex]",
      palettes: "id, projectId, assetId, [projectId+savedAt]",
    }).upgrade(async (transaction) => {
      await transaction.table("projects").toCollection().modify((project: MigratingProjectRecord) => {
        const composition = project.composition ?? {};
        project.schemaVersion = 4;
        project.composition = {
          ...structuredClone(defaultCompositionPlan),
          ...composition,
          crop: {
            ...defaultCompositionPlan.crop,
            ...(composition.crop ?? {}),
          },
        };
      });
    });
    this.version(7).stores({
      projects: "id, updatedAt",
      assets: "id, projectId, [projectId+role]",
      analyses: "id, assetId, [assetId+assetRevision+analysisVersion]",
      fallbackBlobs: "assetId",
      storageBindings: "projectId, rootKey",
      paintColors: "id, projectId, manufacturer, name",
      paintMixNotes: "id, projectId, [projectId+targetHex]",
      palettes: "id, projectId, assetId, [projectId+savedAt]",
    }).upgrade(async (transaction) => {
      await Promise.all([
        transaction.table("projects").toCollection().modify((project: MigratingProjectRecord) => {
          const composition = project.composition ?? {};
          project.schemaVersion = projectSchemaVersion;
          project.composition = {
            ...structuredClone(defaultCompositionPlan),
            ...composition,
            crop: {
              ...defaultCompositionPlan.crop,
              ...(composition.crop ?? {}),
            },
          };
          project.workspace ??= structuredClone(defaultProjectWorkspace);
          project.workspace.paint ??= structuredClone(defaultProjectWorkspace.paint);
          project.workspace.paint.mixingModel ??= "rgb";
          project.workspace.paint.draft ??= structuredClone(defaultProjectWorkspace.paint.draft);
          project.workspace.paint.draft.reflectanceSamples ??= "";
          project.workspace.paint.draft.spectralProvenance ??= "measured";
          project.workspace.paint.draft.spectralSource ??= "";
          project.workspace.paint.draft.infiniteLayerConfirmed ??= false;
          project.workspace.paint.draft.densityGPerMl ??= "";
        }),
        transaction.table("paintColors").toCollection().modify((paint: MigratingPaintColorRecord) => {
          paint.schemaVersion = 2;
        }),
      ]);
    });
  }
}

export type StoredPaletteRecord = {
  id: string;
  projectId: ProjectId;
  assetId: PaletteExtraction["assetId"];
  assetRevision: PaletteExtraction["assetRevision"];
  sourceRole: "reference" | "artwork";
  requestedColors: PaletteExtraction["requestedColors"];
  palette: PaletteExtraction;
  savedAt: string;
};

export const database = new PaintToolDatabase();
