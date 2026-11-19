import {
  analysisCacheId,
  imageAnalysisSchema,
  projectAssetSchema,
  projectSchema,
  type AssetRevision,
} from "../domain";
import type { ImageAnalysis, Project, ProjectAsset, ProjectId } from "../domain";
import { database } from "./db";
import type { DirectoryHandleLike } from "./filesystem-types";

export class ProjectRepository {
  async listProjects(): Promise<Project[]> {
    const projects = await database.projects.orderBy("updatedAt").reverse().toArray();
    return projects.map((project) => projectSchema.parse(project));
  }

  async saveProject(project: Project): Promise<void> {
    await database.projects.put(projectSchema.parse(project));
  }

  async getProject(projectId: ProjectId): Promise<Project | undefined> {
    const project = await database.projects.get(projectId);
    return project ? projectSchema.parse(project) : undefined;
  }

  async saveAsset(asset: ProjectAsset): Promise<void> {
    await database.assets.put(projectAssetSchema.parse(asset));
  }

  async listAssets(projectId: ProjectId): Promise<ProjectAsset[]> {
    const assets = await database.assets.where("projectId").equals(projectId).toArray();
    return assets.map((asset) => projectAssetSchema.parse(asset));
  }

  async getAsset(assetId: ProjectAsset["id"]): Promise<ProjectAsset | undefined> {
    const asset = await database.assets.get(assetId);
    return asset ? projectAssetSchema.parse(asset) : undefined;
  }

  async saveAnalysis(analysis: ImageAnalysis): Promise<void> {
    await database.analyses.put(imageAnalysisSchema.parse(analysis));
  }

  async replaceAssetAndAnalysis(
    asset: ProjectAsset,
    analysis: ImageAnalysis,
    fallbackBlob?: Blob,
  ): Promise<ProjectAsset[]> {
    const validAsset = projectAssetSchema.parse(asset);
    const validAnalysis = imageAnalysisSchema.parse(analysis);
    return database.transaction(
      "rw",
      database.assets,
      database.analyses,
      database.fallbackBlobs,
      database.palettes,
      async () => {
        const existing = await database.assets
          .where("[projectId+role]")
          .equals([validAsset.projectId, validAsset.role])
          .toArray();
        const replaced = existing.filter((item) => item.id !== validAsset.id);
        for (const oldAsset of replaced) {
          await database.analyses.where("assetId").equals(oldAsset.id).delete();
        }
        await database.palettes.where("assetId").anyOf(replaced.map((item) => item.id)).delete();
        await database.assets.bulkDelete(replaced.map((item) => item.id));
        await database.fallbackBlobs.bulkDelete(replaced.map((item) => item.id));
        await database.assets.put(validAsset);
        await database.analyses.put(validAnalysis);
        if (fallbackBlob) {
          await database.fallbackBlobs.put({
            assetId: validAsset.id,
            blob: fallbackBlob,
            savedAt: new Date().toISOString(),
          });
        }
        return replaced;
      },
    );
  }

  async getAnalysis(
    assetId: ProjectAsset["id"],
    assetRevision: AssetRevision,
  ): Promise<ImageAnalysis | undefined> {
    const analysis = await database.analyses.get(analysisCacheId(assetId, assetRevision));
    return analysis ? imageAnalysisSchema.parse(analysis) : undefined;
  }

  async saveFallbackBlob(assetId: ProjectAsset["id"], blob: Blob): Promise<void> {
    await database.fallbackBlobs.put({
      assetId,
      blob,
      savedAt: new Date().toISOString(),
    });
  }

  async getFallbackBlob(assetId: ProjectAsset["id"]): Promise<Blob | undefined> {
    return (await database.fallbackBlobs.get(assetId))?.blob;
  }

  async saveStorageBinding(binding: {
    projectId: ProjectId;
    rootKey: string;
    rootHandle: DirectoryHandleLike;
  }): Promise<void> {
    await database.storageBindings.put({
      ...binding,
      createdAt: new Date().toISOString(),
    });
  }

  async getStorageBinding(projectId: ProjectId) {
    return database.storageBindings.get(projectId);
  }
}

export const projectRepository = new ProjectRepository();
