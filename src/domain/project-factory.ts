import {
  defaultCompositionPlan,
  defaultProjectWorkspace,
  type Project,
  type ProjectAsset,
} from "./project";
import {
  createAssetRevision,
  createId,
  type AssetId,
  type ProjectId,
} from "./ids";

export function createProject(name: string, now = new Date()): Project {
  const timestamp = now.toISOString();
  return {
    id: createId<"ProjectId">(),
    schemaVersion: 3,
    name: name.trim() || "Új festőprojekt",
    createdAt: timestamp,
    updatedAt: timestamp,
    composition: structuredClone(defaultCompositionPlan),
    workspace: structuredClone(defaultProjectWorkspace),
    storage: {
      mode: "indexeddb",
    },
  };
}

export function createProjectAsset(input: {
  projectId: ProjectId;
  role: ProjectAsset["role"];
  file: Pick<File, "name" | "type" | "size" | "lastModified">;
  storageMode: ProjectAsset["storageMode"];
  width?: number;
  height?: number;
}): ProjectAsset {
  const { file } = input;
  const id = createId<"AssetId">();
  const safeFileName = file.name.replace(/[\\/]/g, "_");
  return {
    id,
    projectId: input.projectId,
    role: input.role,
    fileName: file.name,
    relativePath: `source/${input.role}/${id.slice(0, 8)}_${safeFileName}`,
    mimeType: file.type || "application/octet-stream",
    byteSize: file.size,
    lastModified: file.lastModified,
    storageMode: input.storageMode,
    width: input.width,
    height: input.height,
  };
}

export function assetRevision(asset: ProjectAsset) {
  return createAssetRevision({
    fileName: asset.fileName,
    byteSize: asset.byteSize,
    lastModified: asset.lastModified,
  });
}

export function analysisCacheId(assetId: AssetId, revision: string): string {
  return `image-analysis:v1:${assetId}:${revision}`;
}
