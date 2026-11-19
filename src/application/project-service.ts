import {
  analysisCacheId,
  assetRevision,
  createProject,
  createProjectAsset,
  type AssetRole,
  type ImageAnalysis,
  type Project,
  type ProjectAsset,
} from "../domain";
import { assetStorage } from "../storage";
import { projectRepository } from "../storage";
import type { AssetFallbackReason } from "../storage/asset-storage";
import type { ImageProcessingClient, AnalysisProgress } from "../image-processing/client";

export async function createAndSaveProject(name: string): Promise<Project> {
  const project = createProject(name);
  await projectRepository.saveProject(project);
  return project;
}

export async function attachDirectory(project: Project): Promise<Project> {
  return (await assetStorage.bindProjectDirectory(project)).project;
}

export async function importAndAnalyzeAsset(
  project: Project,
  role: AssetRole,
  file: File,
  client: ImageProcessingClient,
  confirmFallback: (reason: AssetFallbackReason) => boolean,
  onProgress?: (progress: AnalysisProgress) => void,
): Promise<{ project: Project; asset: ProjectAsset; analysis: ImageAnalysis; warning?: string } | null> {
  const initialAsset = createProjectAsset({
    projectId: project.id,
    role,
    file,
    storageMode: project.storage.mode,
  });
  const stored = await assetStorage.saveAsset(project, initialAsset, file, confirmFallback);
  if (stored.cancelled) {
    return null;
  }

  const asset: ProjectAsset = {
    ...initialAsset,
    storageMode: stored.mode,
  };
  try {
    const analysis = await client.analyze(
      {
        assetId: asset.id,
        assetRevision: assetRevision(asset),
        source: file,
      },
      onProgress,
    );
    const analyzedAsset: ProjectAsset = {
      ...asset,
      width: analysis.width,
      height: analysis.height,
    };
    const replacedAssets = await projectRepository.replaceAssetAndAnalysis(
      analyzedAsset,
      analysis,
      stored.mode === "indexeddb" ? file : undefined,
    );
    await Promise.all(replacedAssets.map((replaced) => assetStorage.removeAssetFile(project, replaced)));

    const updatedProject: Project = {
      ...project,
      updatedAt: new Date().toISOString(),
    };
    await projectRepository.saveProject(updatedProject);
    return {
      project: updatedProject,
      asset: analyzedAsset,
      analysis,
      warning: stored.warning,
    };
  } catch (error) {
    await assetStorage.removeAssetFile(project, asset);
    throw error;
  }
}

export async function getCachedAnalysis(asset: ProjectAsset) {
  return projectRepository.getAnalysis(asset.id, assetRevision(asset));
}

export function cacheKeyFor(asset: ProjectAsset) {
  return analysisCacheId(asset.id, assetRevision(asset));
}
