import { create } from "zustand";
import type { ImageAnalysis, Project, ProjectAsset } from "../domain";

export type AnalysisStatus = "idle" | "loading" | "ready" | "error";

type AppState = {
  projects: Project[];
  activeProject: Project | null;
  assets: ProjectAsset[];
  analyses: Record<string, ImageAnalysis>;
  analysisStatus: AnalysisStatus;
  progressLabel: string;
  message: string;
  error: string | null;
  setProjects: (projects: Project[]) => void;
  setActiveProject: (project: Project | null) => void;
  setAssets: (assets: ProjectAsset[]) => void;
  setAnalysis: (analysis: ImageAnalysis) => void;
  setAnalysisStatus: (status: AnalysisStatus, progressLabel?: string) => void;
  setMessage: (message: string) => void;
  setError: (error: string | null) => void;
};

export const useAppStore = create<AppState>((set) => ({
  projects: [],
  activeProject: null,
  assets: [],
  analyses: {},
  analysisStatus: "idle",
  progressLabel: "",
  message: "",
  error: null,
  setProjects: (projects) => set({ projects }),
  setActiveProject: (activeProject) => set({ activeProject }),
  setAssets: (assets) => set({ assets }),
  setAnalysis: (analysis) => set((state) => ({
    analyses: {
      ...state.analyses,
      [analysis.assetId]: analysis,
    },
  })),
  setAnalysisStatus: (analysisStatus, progressLabel = "") => set({ analysisStatus, progressLabel }),
  setMessage: (message) => set({ message, error: null }),
  setError: (error) => set({ error }),
}));
