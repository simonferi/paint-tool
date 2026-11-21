import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "./store";
import {
  attachDirectory,
  createAndSaveProject,
  getCachedAnalysis,
  importAndAnalyzeAsset,
} from "../application/project-service";
import { ImageProcessingClient } from "../image-processing/client";
import {
  compositionPlanSchema,
  defaultCompositionPlan,
  defaultProjectWorkspace,
  type AssetRole,
  type CompositionPlan,
  type GridMode,
  type Project,
  type ProjectAsset,
  type ProjectWorkspace,
} from "../domain";
import { assetStorage, projectRepository } from "../storage";
import type { AssetFallbackReason } from "../storage/asset-storage";
import { directoryPickerAvailable } from "../storage/filesystem-types";
import { CompositionPreview } from "../features/composition/CompositionPreview";
import { PaletteWorkspace } from "../features/palette/PaletteWorkspace";
import {
  compositionSummary,
  validateCompositionPlan,
  type GeometryMessageKey,
} from "../features/composition/geometry";
import type { AnalysisProgress } from "../image-processing/client";
import i18nInstance, { supportedLanguages, type SupportedLanguage } from "../i18n";

const languageNameKeys = {
  en: "app.languageEnglish",
  sk: "app.languageSlovak",
  cs: "app.languageCzech",
  hu: "app.languageHungarian",
} as const satisfies Record<SupportedLanguage, string>;

const progressKeys = {
  decode: "progress.decode",
  sample: "progress.sample",
  analyze: "progress.analyze",
  quantize: "progress.quantize",
  map: "progress.map",
} as const satisfies Record<AnalysisProgress["stage"], string>;

function roleKey(role: AssetRole): "roles.reference" | "roles.artwork" {
  return role === "reference" ? "roles.reference" : "roles.artwork";
}

function roleUploadKey(role: AssetRole): "roles.referenceUpload" | "roles.artworkUpload" {
  return role === "reference" ? "roles.referenceUpload" : "roles.artworkUpload";
}

function formatMean(mean: number) {
  return `${Math.round((mean / 255) * 100)} / 100`;
}

function formatAspectRatio(width: number, height: number, locale: string): string {
  let first = width;
  let second = height;
  while (second !== 0) {
    [first, second] = [second, first % second];
  }
  const divisor = Math.max(1, first);
  return `${width / divisor}:${height / divisor} (${(width / height).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })})`;
}

function ProjectImagePreview({
  project,
  role,
  asset,
  pendingFile,
}: {
  project: Project;
  role: AssetRole;
  asset?: ProjectAsset;
  pendingFile?: File;
}) {
  const { t, i18n } = useTranslation();
  const storageProject = useMemo(
    () => ({ id: project.id, storage: project.storage }),
    [project.id, project.storage],
  );
  const [src, setSrc] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setSrc(null);
    setDimensions(null);
    setError("");

    const showBlob = (blob: Blob | undefined) => {
      if (!active) return;
      if (!blob) {
        setError(i18nInstance.t("images.savedUnavailable"));
        return;
      }
      objectUrl = URL.createObjectURL(blob);
      setSrc(objectUrl);
    };

    if (pendingFile) {
      showBlob(pendingFile);
    } else if (asset) {
      assetStorage.readAsset(storageProject, asset)
        .then(showBlob)
        .catch((readError: unknown) => {
          if (active) {
            setError(readError instanceof Error ? readError.message : i18nInstance.t("images.loadError"));
          }
        });
    }

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset, pendingFile, storageProject]);

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-stone-200 bg-white">
      <div className="grid min-h-44 place-items-center bg-stone-100 p-3">
        {src ? (
          <img
            src={src}
            alt={t("images.previewAlt", { role: t(roleKey(role)) })}
            onLoad={(event) => setDimensions({
              width: event.currentTarget.naturalWidth,
              height: event.currentTarget.naturalHeight,
            })}
            onError={() => setError(t("images.openError"))}
            className="block h-auto w-auto max-h-64 max-w-full object-contain"
          />
        ) : (
          <p className="px-4 text-center text-xs text-stone-500">
            {error || t("images.previewPlaceholder")}
          </p>
        )}
      </div>
      {(dimensions || error) && (
        <p role={error ? "status" : undefined} className="px-3 py-2 text-xs text-stone-600">
          {error || (dimensions && (
            <>
              {dimensions.width} × {dimensions.height} px · {t("images.aspectRatio", {
                ratio: formatAspectRatio(dimensions.width, dimensions.height, i18n.language),
              })}
            </>
          ))}
        </p>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  active,
  onSelect,
}: {
  project: Project;
  active: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border px-4 py-3 text-left transition ${
        active
          ? "border-emerald-700 bg-emerald-50 shadow-sm"
          : "border-stone-200 bg-white hover:border-emerald-300"
      }`}
    >
      <span className="block text-sm font-semibold text-stone-800">{project.name}</span>
      <span className="mt-1 block text-xs text-stone-500">
        {project.storage.mode === "filesystem" ? t("projects.folderAttached") : t("projects.fallbackCard")}
      </span>
    </button>
  );
}

function AssetCard({
  asset,
  analysis,
}: {
  asset: ProjectAsset;
  analysis?: ReturnType<typeof useAppStore.getState>["analyses"][string];
}) {
  const { t } = useTranslation();
  return (
    <article className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {t(roleKey(asset.role))}
          </p>
          <h3 className="mt-2 break-all text-base font-semibold text-stone-800">{asset.fileName}</h3>
          <p className="mt-1 text-xs text-stone-500">
            {asset.width && asset.height ? `${asset.width} × ${asset.height} px · ` : ""}
            {asset.storageMode === "filesystem" ? t("images.storageFile") : t("images.storageFallback")}
          </p>
        </div>
        <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] font-medium text-stone-500">
          {asset.relativePath}
        </span>
      </div>
      {analysis ? (
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-stone-100 pt-4 text-xs text-stone-600">
          <span>{t("analysis.meanTone")}: <strong className="text-stone-800">{formatMean(analysis.tone.mean)}</strong></span>
          <span>{t("analysis.analyzedPixels")}: <strong className="text-stone-800">{analysis.tone.sampleCount}</strong></span>
          <span className="col-span-2">{t("analysis.toneDistribution")}: <strong className="text-stone-800">{analysis.tone.bins.join(" · ")}</strong></span>
        </div>
      ) : (
        <p className="mt-4 border-t border-stone-100 pt-4 text-xs text-stone-500">{t("analysis.unavailable")}</p>
      )}
    </article>
  );
}

type CompositionFeedback =
  | { kind: "autoSaved" | "saved" | "validation" }
  | { kind: "geometry"; key: GeometryMessageKey }
  | { kind: "error"; details?: string };

type AppMessageKey =
  | "projects.created"
  | "projects.folderNotAvailable"
  | "projects.folderConnected"
  | "images.consentDeclined"
  | "analysis.localFallbackNotice"
  | "analysis.imageSaved";

type AppMessage = {
  key: AppMessageKey;
  role?: AssetRole;
};

export function App() {
  const { t, i18n } = useTranslation();
  const [projectName, setProjectName] = useState("");
  const [appMessage, setAppMessage] = useState<AppMessage | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [busyRole, setBusyRole] = useState<AssetRole | null>(null);
  const [pendingFiles, setPendingFiles] = useState<Partial<Record<AssetRole, File>>>({});
  const [compositionDraft, setCompositionDraft] = useState<CompositionPlan>(defaultCompositionPlan);
  const [workspaceDraft, setWorkspaceDraft] = useState<ProjectWorkspace>(defaultProjectWorkspace);
  const [metadataProjectId, setMetadataProjectId] = useState<Project["id"] | null>(null);
  const [compositionFeedback, setCompositionFeedback] = useState<CompositionFeedback | null>(null);
  const inputRefs = {
    reference: useRef<HTMLInputElement>(null),
    artwork: useRef<HTMLInputElement>(null),
  };
  const clientRef = useRef<ImageProcessingClient | null>(null);
  const {
    projects,
    activeProject,
    assets,
    analyses,
    progressLabel,
    error,
    setProjects,
    setActiveProject,
    setAssets,
    setAnalysis,
    setAnalysisStatus,
    setError,
    analysisStatus,
  } = useAppStore();
  const activeProjectId = activeProject?.id;
  const updatePalettePreferences = useCallback((
    update: Partial<ProjectWorkspace["palette"]>,
  ) => {
    setCompositionFeedback(null);
    setWorkspaceDraft((current) => ({
      ...current,
      palette: { ...current.palette, ...update },
    }));
  }, []);
  const updatePaintPreferences = useCallback((
    update: Partial<ProjectWorkspace["paint"]>,
  ) => {
    setCompositionFeedback(null);
    setWorkspaceDraft((current) => ({
      ...current,
      paint: { ...current.paint, ...update },
    }));
  }, []);
  const updateCropFrame = useCallback((crop: CompositionPlan["crop"]) => {
    setCompositionFeedback(null);
    setCompositionDraft((current) => ({ ...current, crop }));
  }, []);

  useEffect(() => {
    const project = useAppStore.getState().activeProject;
    if (project && project.id === activeProjectId) {
      setCompositionDraft(structuredClone(project.composition ?? defaultCompositionPlan));
      setWorkspaceDraft(structuredClone(project.workspace ?? defaultProjectWorkspace));
      setMetadataProjectId(project.id);
      setCompositionFeedback(null);
    }
  }, [activeProjectId]);

  const persistProjectMetadata = useCallback(async (
    project: Project,
    composition: CompositionPlan,
    workspace: ProjectWorkspace,
  ): Promise<Project> => {
    const updatedProject: Project = {
      ...project,
      composition,
      workspace,
      updatedAt: new Date().toISOString(),
    };
    await projectRepository.saveProject(updatedProject);
    const state = useAppStore.getState();
    setProjects(state.projects.map((item) => item.id === project.id ? updatedProject : item));
    if (state.activeProject?.id === project.id) {
      setActiveProject(updatedProject);
    }
    return updatedProject;
  }, [setActiveProject, setProjects]);

  useEffect(() => {
    if (!activeProjectId || activeProjectId !== metadataProjectId || initializing) return;
    const projectId = activeProjectId;
    const timer = window.setTimeout(() => {
      const project = useAppStore.getState().activeProject;
      if (!project || project.id !== projectId) return;
      persistProjectMetadata(project, compositionDraft, workspaceDraft)
        .then(() => setCompositionFeedback({ kind: "autoSaved" }))
        .catch((saveError: unknown) => {
          setCompositionFeedback({
            kind: "error",
            details: saveError instanceof Error ? saveError.message : undefined,
          });
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    activeProjectId,
    compositionDraft,
    workspaceDraft,
    metadataProjectId,
    initializing,
    persistProjectMetadata,
  ]);

  useEffect(() => {
    let active = true;
    const client = new ImageProcessingClient();
    clientRef.current = client;
    projectRepository.listProjects()
      .then(async (storedProjects) => {
        if (!active) return;
        setProjects(storedProjects);
        const first = storedProjects[0] ?? null;
        setActiveProject(first);
        if (first) {
          const storedAssets = await projectRepository.listAssets(first.id);
          setAssets(storedAssets);
          for (const asset of storedAssets) {
            const cached = await getCachedAnalysis(asset);
            if (cached) setAnalysis(cached);
          }
        }
      })
      .catch((loadError: unknown) => {
        setError(loadError instanceof Error ? loadError.message : i18nInstance.t("projects.loadError"));
      })
      .finally(() => {
        if (active) setInitializing(false);
      });

    return () => {
      active = false;
      client.dispose();
      if (clientRef.current === client) {
        clientRef.current = null;
      }
    };
  }, [setActiveProject, setAnalysis, setAssets, setError, setProjects]);

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (activeProject && metadataProjectId === activeProject.id) {
        await persistProjectMetadata(activeProject, compositionDraft, workspaceDraft);
      }
      const project = await createAndSaveProject(projectName || t("projects.defaultName"));
      const nextProjects = [project, ...projects];
      setProjects(nextProjects);
      setActiveProject(project);
      setAssets([]);
      setProjectName("");
      setAppMessage({ key: "projects.created" });
    } catch (createError: unknown) {
      setError(createError instanceof Error ? createError.message : t("projects.createError"));
    }
  }

  async function handleSelectProject(project: Project) {
    if (activeProject && metadataProjectId === activeProject.id) {
      await persistProjectMetadata(activeProject, compositionDraft, workspaceDraft);
    }
    const storedProject = await projectRepository.getProject(project.id) ?? project;
    setActiveProject(storedProject);
    setAssets([]);
    setAppMessage(null);
    setError(null);
    const storedAssets = await projectRepository.listAssets(project.id);
    setAssets(storedAssets);
    for (const asset of storedAssets) {
      const cached = await getCachedAnalysis(asset);
      if (cached) setAnalysis(cached);
    }
  }

  async function handleAttachDirectory() {
    if (!activeProject) return;
    try {
      const result = await attachDirectory(activeProject);
      if (!result.storage.mode || result.storage.mode !== "filesystem") {
        setAppMessage({ key: "projects.folderNotAvailable" });
        return;
      }
      setActiveProject(result);
      setProjects(projects.map((project) => project.id === result.id ? result : project));
      setAppMessage({ key: "projects.folderConnected" });
    } catch (attachError: unknown) {
      setError(attachError instanceof Error ? attachError.message : t("projects.folderError"));
    }
  }

  async function handleFile(role: AssetRole, file: File | undefined) {
    if (!file || !activeProject) return;
    setPendingFiles((current) => ({ ...current, [role]: file }));
    const client = clientRef.current;
    if (!client) {
      setError(t("progress.workerNotReady"));
      setPendingFiles((current) => ({ ...current, [role]: undefined }));
      return;
    }
    setBusyRole(role);
    setAnalysisStatus("loading", t("progress.analysisStarting"));
    setError(null);
    try {
      const result = await importAndAnalyzeAsset(
        activeProject,
        role,
        file,
        client,
        (reason: AssetFallbackReason) => {
          const reasonMessage = reason.type === "projectFolderNotAttached"
            ? t("images.folderNotAttached")
            : reason.type === "projectFolderUnavailable"
              ? t("images.folderUnavailable")
              : reason.details
                ? t("images.folderWriteFailed", { details: reason.details })
                : t("images.folderWriteFailedGeneric");
          return window.confirm(`${reasonMessage}\n\n${t("images.consentTitle")}`);
        },
        (progress) => setAnalysisStatus(
          "loading",
          `${t(progressKeys[progress.stage])} · ${progress.completed}/${progress.total}`,
        ),
      );
      if (!result) {
        setAnalysisStatus("idle", "");
        setAppMessage({ key: "images.consentDeclined" });
        return;
      }
      setActiveProject(result.project);
      setProjects(projects.map((project) => project.id === result.project.id ? result.project : project));
      setAssets([...assets.filter((asset) => asset.role !== role), result.asset]);
      setAnalysis(result.analysis);
      setAnalysisStatus("ready", t("progress.analysisReady"));
      setAppMessage(result.warning
        ? { key: "analysis.localFallbackNotice" }
        : { key: "analysis.imageSaved", role });
    } catch (uploadError: unknown) {
      setAnalysisStatus("error", "");
      setError(uploadError instanceof Error ? uploadError.message : t("images.fileSaveError"));
    } finally {
      setBusyRole(null);
      setPendingFiles((current) => ({ ...current, [role]: undefined }));
      const input = inputRefs[role].current;
      if (input) input.value = "";
    }
  }

  async function handleSaveComposition() {
    if (!activeProject) return;
    const errors = validateCompositionPlan(compositionDraft);
    if (errors.length > 0) {
      setCompositionFeedback({ kind: "geometry", key: errors[0] });
      return;
    }
    const parsed = compositionPlanSchema.safeParse(compositionDraft);
    if (!parsed.success) {
      setCompositionFeedback({ kind: "validation" });
      return;
    }
    try {
      await persistProjectMetadata(activeProject, parsed.data, workspaceDraft);
      setCompositionDraft(parsed.data);
      setCompositionFeedback({ kind: "saved" });
    } catch (saveError: unknown) {
      setCompositionFeedback({
        kind: "error",
        details: saveError instanceof Error ? saveError.message : undefined,
      });
    }
  }

  useEffect(() => {
    document.title = t("app.documentTitle");
    document.documentElement.lang = i18n.resolvedLanguage ?? "en";
    document.querySelector('meta[name="description"]')
      ?.setAttribute("content", t("app.documentDescription"));
  }, [i18n.language, i18n.resolvedLanguage, t]);

  function formatCompositionSummary(): string {
    const summary = compositionSummary(compositionDraft);
    if (summary.type === "error") return t(summary.message);
    if (summary.type === "none") return t("composition.summaryNoGrid");
    if (summary.type === "diagonals") return t("composition.summaryDiagonals");
    if (summary.type === "metric") {
      return t("composition.summaryMetric", {
        ...summary,
        cellCm: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(summary.cellCm),
      });
    }
    if (summary.widthSpacing === null || summary.heightSpacing === null) {
      return t("composition.summaryGridMissingSize", summary);
    }
    const options = {
      ...summary,
      widthSpacing: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(summary.widthSpacing),
      heightSpacing: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(summary.heightSpacing),
    };
    return t(
      compositionDraft.grid.mode === "custom" ? "composition.summaryCustomGrid" : "composition.summaryGrid",
      options,
    );
  }

  function getCompositionFeedbackText(): string {
    if (!compositionFeedback) return formatCompositionSummary();
    switch (compositionFeedback.kind) {
      case "autoSaved":
        return t("composition.autoSaved");
      case "saved":
        return t("composition.saved");
      case "validation":
        return t("composition.validation");
      case "geometry":
        return t(compositionFeedback.key);
      case "error":
        return compositionFeedback.details
          ? `${t("composition.saveError")} ${compositionFeedback.details}`
          : t("composition.saveError");
    }
  }

  if (initializing) {
    return <main className="grid min-h-screen place-items-center bg-stone-100 text-stone-600">{t("app.loading")}</main>;
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_right,_#eadfc9_0,_#f5f1e8_35rem)] text-stone-800">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
        <header className="flex flex-col justify-between gap-5 border-b border-stone-300/70 pb-8 sm:flex-row sm:items-end">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-emerald-700">{t("app.eyebrow")}</p>
            <h1 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">
              Line <span className="font-serif italic text-emerald-800">&</span> Tone
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
              {t("app.description")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="language-select">{t("app.language")}</label>
            <select
              id="language-select"
              aria-label={t("app.language")}
              value={i18n.resolvedLanguage ?? "en"}
              onChange={(event) => void i18n.changeLanguage(event.target.value as SupportedLanguage)}
              className="rounded-full border border-stone-300 bg-white px-3 py-2 text-xs text-stone-700"
            >
              {supportedLanguages.map((language) => (
                <option key={language} value={language}>
                  {t(languageNameKeys[language])}
                </option>
              ))}
            </select>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {t("app.localProcessing")}
            </span>
          </div>
        </header>

        <div className="mt-8 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-2xl border border-stone-200 bg-white/80 p-5 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">{t("projects.heading")}</p>
              <form className="mt-4 flex gap-2" onSubmit={handleCreateProject}>
                <input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  aria-label={t("projects.name")}
                  placeholder={t("projects.namePlaceholder")}
                  className="min-w-0 flex-1 rounded-lg border border-stone-200 px-3 py-2 text-sm outline-none ring-emerald-600 focus:ring-2"
                />
                <button
                  aria-label={t("projects.create")}
                  title={t("projects.create")}
                  className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
                  type="submit"
                >
                  +
                </button>
              </form>
              <div className="mt-4 space-y-2">
                {projects.length === 0 ? (
                  <p className="text-xs leading-5 text-stone-500">{t("projects.none")}</p>
                ) : projects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    active={project.id === activeProject?.id}
                    onSelect={() => void handleSelectProject(project)}
                  />
                ))}
              </div>
            </section>
            {activeProject && (
              <nav
                aria-label={t("app.navigation")}
                className="rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-sm"
              >
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-500">
                  {t("app.navigation")}
                </p>
                <div className="grid gap-1">
                  {([
                    ["step-images", "app.stepImages"],
                    ["step-composition", "app.stepComposition"],
                    ["step-palette", "app.stepPalette"],
                    ["step-paint-planning", "app.stepPaint"],
                  ] as const).map(([id, key]) => (
                    <a
                      key={id}
                      href={`#${id}`}
                      className="rounded-lg px-3 py-2 text-sm text-stone-600 transition hover:bg-emerald-50 hover:text-emerald-900"
                    >
                      {t(key)}
                    </a>
                  ))}
                </div>
              </nav>
            )}
          </aside>

          <section className="space-y-6">
            {!activeProject ? (
              <div className="rounded-2xl border border-dashed border-stone-300 bg-white/70 p-10 text-center">
                <h2 className="text-lg font-semibold">{t("projects.startHeading")}</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-stone-500">
                  {t("projects.startDescription")}
                </p>
              </div>
            ) : (
              <>
                <section className="rounded-2xl border border-stone-200 bg-white/85 p-6 shadow-sm">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{t("projects.active")}</p>
                      <h2 className="mt-2 text-2xl font-semibold">{activeProject.name}</h2>
                      <p className="mt-2 text-sm text-stone-500">
                        {t("projects.storage")}: {activeProject.storage.mode === "filesystem" ? t("projects.folder") : t("projects.fallback")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleAttachDirectory()}
                      disabled={!directoryPickerAvailable()}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("projects.attach")}
                    </button>
                  </div>
                  {!directoryPickerAvailable() && (
                    <p className="mt-4 text-xs text-amber-700">{t("projects.folderUnavailable")}</p>
                  )}
                  {appMessage && (
                    <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                      {appMessage.role
                        ? t(appMessage.key, { role: t(roleKey(appMessage.role)) })
                        : t(appMessage.key)}
                    </p>
                  )}
                  {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
                </section>

                <section
                  id="step-images"
                  aria-labelledby="images-heading"
                  className="scroll-mt-6 rounded-2xl border border-stone-200 bg-white/85 p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{t("analysis.imagesSectionEyebrow")}</p>
                      <h2 id="images-heading" className="mt-2 text-xl font-semibold">{t("images.heading")}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
                        {t("images.description")}
                      </p>
                    </div>
                    <span className="text-xs text-stone-500">
                      {analysisStatus === "loading"
                        ? progressLabel
                        : analysisStatus === "ready" ? t("progress.analysisReady") : t("progress.ready")}
                    </span>
                  </div>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {(["reference", "artwork"] as const).map((role) => (
                      <div key={role} className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-5 transition hover:border-emerald-400 hover:bg-emerald-50/50">
                        <label className="group block cursor-pointer">
                          <span className="block text-sm font-semibold">{t(roleUploadKey(role))}</span>
                        <span className="mt-2 block text-xs leading-5 text-stone-500">{t("images.acceptedTypes")}</span>
                        <span className="mt-4 inline-flex rounded-lg bg-emerald-800 px-3 py-2 text-xs font-semibold text-white group-hover:bg-emerald-900">
                          {busyRole === role ? t("progress.processing") : t("images.choose")}
                        </span>
                        <input
                          ref={inputRefs[role]}
                          className="sr-only"
                          type="file"
                          accept="image/*"
                          disabled={busyRole !== null}
                          onChange={(event) => void handleFile(role, event.target.files?.[0])}
                        />
                        </label>
                        <ProjectImagePreview
                          project={activeProject}
                          role={role}
                          asset={assets.find((asset) => asset.role === role)}
                          pendingFile={pendingFiles[role]}
                        />
                      </div>
                    ))}
                  </div>
                </section>

                <section
                  id="step-composition"
                  aria-labelledby="composition-heading"
                  className="scroll-mt-6 rounded-2xl border border-stone-200 bg-white/85 p-6 shadow-sm"
                >
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{t("analysis.compositionEyebrow")}</p>
                      <h2 id="composition-heading" className="mt-2 text-xl font-semibold">{t("composition.heading")}</h2>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
                        {t("composition.description")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSaveComposition()}
                      disabled={validateCompositionPlan(compositionDraft).length > 0}
                      className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {t("composition.save")}
                    </button>
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-xs font-medium text-stone-600">
                      {t("composition.aspect")}
                      <select
                        value={compositionDraft.aspect}
                        onChange={(event) => setCompositionDraft({
                          ...compositionDraft,
                          aspect: event.target.value as CompositionPlan["aspect"],
                        })}
                        className="rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800"
                      >
                        <option value="free">{t("composition.aspectFree")}</option>
                        <option value="1:1">{t("composition.aspectSquare")}</option>
                        <option value="3:2">{t("composition.aspectLandscape32")}</option>
                        <option value="4:3">{t("composition.aspectLandscape43")}</option>
                        <option value="16:9">{t("composition.aspectPanorama")}</option>
                        <option value="2:3">{t("composition.aspectPortrait")}</option>
                        <option value="custom">{t("composition.aspectCustom")}</option>
                      </select>
                    </label>
                    <label className="grid gap-1.5 text-xs font-medium text-stone-600">
                      {t("composition.grid")}
                      <select
                        value={compositionDraft.grid.mode}
                        onChange={(event) => setCompositionDraft({
                          ...compositionDraft,
                          grid: { ...compositionDraft.grid, mode: event.target.value as GridMode },
                        })}
                        className="rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800"
                      >
                        <option value="thirds">{t("composition.gridThirds")}</option>
                        <option value="quarters">{t("composition.gridQuarters")}</option>
                        <option value="6x6">{t("composition.gridSix")}</option>
                        <option value="8x8">{t("composition.gridEight")}</option>
                        <option value="10x10">{t("composition.gridTen")}</option>
                        <option value="custom">{t("composition.gridCustom")}</option>
                        <option value="metric">{t("composition.gridMetric")}</option>
                        <option value="diagonals">{t("composition.gridDiagonals")}</option>
                        <option value="none">{t("composition.gridNone")}</option>
                      </select>
                    </label>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1.5 text-xs text-stone-600">
                      {t("composition.width")}
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={compositionDraft.widthCm ?? ""}
                        onChange={(event) => setCompositionDraft({
                          ...compositionDraft,
                          widthCm: event.target.value === "" ? null : Number(event.target.value),
                        })}
                        className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm text-stone-800"
                      />
                    </label>
                    <label className="grid gap-1.5 text-xs text-stone-600">
                      {t("composition.height")}
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={compositionDraft.heightCm ?? ""}
                        onChange={(event) => setCompositionDraft({
                          ...compositionDraft,
                          heightCm: event.target.value === "" ? null : Number(event.target.value),
                        })}
                        className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm text-stone-800"
                      />
                    </label>
                  </div>
                  <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label className="grid gap-1.5 text-xs text-stone-600">
                        {t("composition.frameMode")}
                        <select
                          value={compositionDraft.crop.mode}
                          onChange={(event) => {
                            const mode = event.target.value as CompositionPlan["crop"]["mode"];
                            setCompositionDraft({
                              ...compositionDraft,
                              crop: {
                                ...compositionDraft.crop,
                                mode,
                                scale: mode === "crop"
                                  ? Math.min(1, compositionDraft.crop.scale)
                                  : Math.max(1, compositionDraft.crop.scale),
                              },
                            });
                          }}
                          className="rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800"
                        >
                          <option value="crop">{t("composition.modeCrop")}</option>
                          <option value="canvas">{t("composition.modeCanvas")}</option>
                        </select>
                      </label>
                      <label className="grid gap-1.5 text-xs text-stone-600">
                        <span className="flex justify-between gap-2">
                          <span>{t("composition.frameScale")}</span>
                          <span>{Math.round(compositionDraft.crop.scale * 100)}%</span>
                        </span>
                        <input
                          type="range"
                          min={compositionDraft.crop.mode === "crop" ? 0.25 : 1}
                          max={compositionDraft.crop.mode === "crop" ? 1 : 2.5}
                          step="0.01"
                          value={compositionDraft.crop.scale}
                          aria-label={t("composition.frameScale")}
                          onChange={(event) => setCompositionDraft({
                            ...compositionDraft,
                            crop: { ...compositionDraft.crop, scale: Number(event.target.value) },
                          })}
                          className="accent-emerald-700"
                        />
                      </label>
                      <p className="self-end text-xs leading-5 text-stone-500">
                        {t("composition.frameHelp")}
                      </p>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-xs text-stone-600">
                        <span className="flex justify-between gap-2">
                          <span>{t("composition.horizontalOffset")}</span>
                          <span>{Math.round(compositionDraft.crop.offsetX * 100)}%</span>
                        </span>
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.01"
                          value={compositionDraft.crop.offsetX}
                          aria-label={t("composition.horizontalOffset")}
                          onChange={(event) => setCompositionDraft({
                            ...compositionDraft,
                            crop: { ...compositionDraft.crop, offsetX: Number(event.target.value) },
                          })}
                          className="accent-emerald-700"
                        />
                      </label>
                      <label className="grid gap-1.5 text-xs text-stone-600">
                        <span className="flex justify-between gap-2">
                          <span>{t("composition.verticalOffset")}</span>
                          <span>{Math.round(compositionDraft.crop.offsetY * 100)}%</span>
                        </span>
                        <input
                          type="range"
                          min="-1"
                          max="1"
                          step="0.01"
                          value={compositionDraft.crop.offsetY}
                          aria-label={t("composition.verticalOffset")}
                          onChange={(event) => setCompositionDraft({
                            ...compositionDraft,
                            crop: { ...compositionDraft.crop, offsetY: Number(event.target.value) },
                          })}
                          className="accent-emerald-700"
                        />
                      </label>
                    </div>
                  </div>
                  {compositionDraft.grid.mode === "custom" && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-xs text-stone-600">
                        {t("composition.columns")}
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          value={compositionDraft.grid.columns}
                          onChange={(event) => setCompositionDraft({
                            ...compositionDraft,
                            grid: { ...compositionDraft.grid, columns: Number(event.target.value) },
                          })}
                          className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm text-stone-800"
                        />
                      </label>
                      <label className="grid gap-1.5 text-xs text-stone-600">
                        {t("composition.rows")}
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          value={compositionDraft.grid.rows}
                          onChange={(event) => setCompositionDraft({
                            ...compositionDraft,
                            grid: { ...compositionDraft.grid, rows: Number(event.target.value) },
                          })}
                          className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm text-stone-800"
                        />
                      </label>
                    </div>
                  )}
                  {compositionDraft.grid.mode === "metric" && (
                    <label className="mt-4 grid max-w-sm gap-1.5 text-xs text-stone-600">
                      {t("composition.cell")}
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        value={compositionDraft.grid.cellCm ?? ""}
                        onChange={(event) => setCompositionDraft({
                          ...compositionDraft,
                          grid: {
                            ...compositionDraft.grid,
                            cellCm: event.target.value === "" ? null : Number(event.target.value),
                          },
                        })}
                        className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm text-stone-800"
                      />
                    </label>
                  )}
                  <p
                    role="status"
                    className={`mt-4 text-xs leading-5 ${
                      compositionFeedback?.kind === "geometry" || compositionFeedback?.kind === "validation"
                        ? "text-amber-700"
                        : compositionFeedback?.kind === "error" ? "text-red-700" : "text-stone-500"
                    }`}
                  >
                    {getCompositionFeedbackText()}
                  </p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {(["reference", "artwork"] as const).map((role) => (
                      <CompositionPreview
                        key={`${role}-${assets.find((asset) => asset.role === role)?.id ?? "empty"}`}
                        project={activeProject}
                        asset={assets.find((asset) => asset.role === role)}
                        plan={compositionDraft}
                        onCropFrameChange={role === "reference" ? updateCropFrame : undefined}
                      />
                    ))}
                  </div>
                </section>

                <section
                  id="step-analysis"
                  aria-labelledby="analysis-heading"
                  className="scroll-mt-6 rounded-2xl border border-stone-200 bg-white/85 p-6 shadow-sm"
                >
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{t("analysis.eyebrow")}</p>
                    <h2 id="analysis-heading" className="mt-2 text-xl font-semibold">{t("analysis.heading")}</h2>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {assets.length === 0 ? (
                      <p className="text-sm text-stone-500">{t("analysis.empty")}</p>
                    ) : assets.map((asset) => (
                      <AssetCard key={asset.id} asset={asset} analysis={analyses[asset.id]} />
                    ))}
                  </div>
                </section>

                <PaletteWorkspace
                  key={`${activeProject.id}:${assets.map((asset) => `${asset.role}:${asset.id}`).sort().join("|")}`}
                  project={activeProject}
                  assets={assets}
                  composition={compositionDraft}
                  client={clientRef.current}
                  preferences={workspaceDraft.palette}
                  onPreferencesChange={updatePalettePreferences}
                  paintPreferences={workspaceDraft.paint}
                  onPaintPreferencesChange={updatePaintPreferences}
                />
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
