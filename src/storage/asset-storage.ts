import type { Project, ProjectAsset } from "../domain";
import { projectRepository } from "./repositories";
import {
  ensureProjectFolders,
  getProjectAssetDirectory,
  pickDirectory,
  writeFile,
  writePaletteFiles,
} from "./filesystem-types";

export type AssetStorageResult = {
  mode: ProjectAsset["storageMode"];
  warning?: string;
  cancelled?: boolean;
};

export type AssetFallbackReason =
  | { type: "projectFolderNotAttached" }
  | { type: "projectFolderUnavailable" }
  | { type: "projectFolderWriteFailed"; details?: string };

export class ProjectAssetStorage {
  async savePaletteMaps(
    project: Pick<Project, "id" | "storage">,
    files: Array<{ name: string; blob: Blob }>,
  ): Promise<boolean> {
    if (project.storage.mode !== "filesystem" || !project.storage.rootKey) {
      return false;
    }

    const binding = await projectRepository.getStorageBinding(project.id);
    if (!binding) {
      throw new Error("A projektmappa már nincs csatolva. Csatold újra a mentéshez.");
    }

    const permission = await binding.rootHandle.queryPermission?.({ mode: "readwrite" });
    if (permission !== "granted") {
      const requested = await binding.rootHandle.requestPermission?.({ mode: "readwrite" });
      if (requested !== "granted") {
        throw new Error("A projektmappa írási engedélye nem érhető el. Engedélyezd újra a mentéshez.");
      }
    }

    await writePaletteFiles(binding.rootHandle, files);
    return true;
  }

  async bindProjectDirectory(project: Project): Promise<{
    project: Project;
    supported: boolean;
  }> {
    let root;
    try {
      root = await pickDirectory();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return { project, supported: true };
      }
      throw error;
    }
    if (!root) {
      return { project, supported: false };
    }

    await ensureProjectFolders(root);
    const rootKey = `${project.id}:${root.name}`;
    await projectRepository.saveStorageBinding({
      projectId: project.id,
      rootKey,
      rootHandle: root,
    });
    const updatedProject: Project = {
      ...project,
      updatedAt: new Date().toISOString(),
      storage: {
        mode: "filesystem",
        rootKey,
      },
    };
    await projectRepository.saveProject(updatedProject);
    return { project: updatedProject, supported: true };
  }

  async saveAsset(
    project: Project,
    asset: ProjectAsset,
    file: Blob,
    confirmFallback: (reason: AssetFallbackReason) => boolean,
  ): Promise<AssetStorageResult> {
    let fallbackReason: AssetFallbackReason = { type: "projectFolderNotAttached" };
    if (project.storage.mode === "filesystem" && project.storage.rootKey) {
      const binding = await projectRepository.getStorageBinding(project.id);
      if (binding) {
        try {
          const permission = await binding.rootHandle.queryPermission?.({ mode: "readwrite" });
          if (permission === "denied" || permission === "prompt") {
            const requested = await binding.rootHandle.requestPermission?.({ mode: "readwrite" });
            if (requested !== "granted") {
              throw new Error("A projektmappa írási engedélye nem érhető el.");
            }
          }
          const directory = await getProjectAssetDirectory(binding.rootHandle, asset.role);
          await writeFile(directory, asset.relativePath.split("/").at(-1)!, file);
          return { mode: "filesystem" };
        } catch (error) {
          fallbackReason = {
            type: "projectFolderWriteFailed",
            details: error instanceof Error ? error.message : undefined,
          };
          console.warn("A projektmappába mentés nem sikerült.", error);
        }
      } else {
        fallbackReason = { type: "projectFolderUnavailable" };
      }
    }

    if (!confirmFallback(fallbackReason)) {
      return { mode: "indexeddb", cancelled: true };
    }
    return {
      mode: "indexeddb",
      warning: "A kép az IndexedDB helyi tárolójába került. A projektmappa nem lett használva.",
    };
  }

  async readAsset(
    project: Pick<Project, "id" | "storage">,
    asset: ProjectAsset,
  ): Promise<Blob | undefined> {
    if (asset.storageMode === "filesystem" && project.storage.rootKey) {
      const binding = await projectRepository.getStorageBinding(project.id);
      if (binding) {
        try {
          const directory = await getProjectAssetDirectory(binding.rootHandle, asset.role);
          const fileName = asset.relativePath.split("/").at(-1);
          if (!fileName) return undefined;
          const file = await directory.getFileHandle(fileName);
          return file.getFile();
        } catch (error) {
          console.warn("A projektmappából nem sikerült beolvasni a képet.", error);
        }
      }
    }
    return projectRepository.getFallbackBlob(asset.id);
  }

  async removeAssetFile(project: Project, asset: ProjectAsset): Promise<void> {
    if (asset.storageMode !== "filesystem" || !project.storage.rootKey) return;
    const binding = await projectRepository.getStorageBinding(project.id);
    const fileName = asset.relativePath.split("/").at(-1);
    if (!binding || !fileName) return;
    try {
      const directory = await getProjectAssetDirectory(binding.rootHandle, asset.role);
      await directory.removeEntry?.(fileName);
    } catch (error) {
      console.warn("A lecserélt projektfájlt nem sikerült eltávolítani.", error);
    }
  }
}

export const assetStorage = new ProjectAssetStorage();
