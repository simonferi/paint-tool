import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
  AssetRole,
  CompositionPlan,
  PaletteExtraction,
  PaletteSize,
  Project,
  ProjectAsset,
  ProjectWorkspace,
} from "../../domain";
import { assetRevision } from "../../domain";
import type { ImageProcessingClient, ProcessingProgress } from "../../image-processing/client";
import { assetStorage, paletteRepository } from "../../storage";
import { getActiveFrameBounds, getCompositionCropKey } from "../composition/geometry";
import { PaintPlanningWorkspace } from "../paint-planning/PaintPlanningWorkspace";
import { drawPaletteMap, renderPaletteMapBlob } from "./palette-map";

const paletteSizes: PaletteSize[] = [4, 5, 6, 8, 10];
const progressKeys = {
  decode: "progress.decode",
  sample: "progress.sample",
  analyze: "progress.analyze",
  quantize: "progress.quantize",
  map: "progress.map",
} as const satisfies Record<ProcessingProgress["stage"], string>;

function percentage(part: number, total: number, locale: string) {
  return `${((part / total) * 100).toLocaleString(locale, {
    maximumFractionDigits: 1,
  })}%`;
}

function PaletteCanvas({
  palette,
  composition,
  label,
  colorNumber,
  showContours,
  downloadFilename,
  downloadLabel,
  onDownloadError,
}: {
  palette: PaletteExtraction;
  composition: CompositionPlan;
  label: string;
  colorNumber?: number;
  showContours: boolean;
  downloadFilename: string;
  downloadLabel: string;
  onDownloadError: (message: string) => void;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      drawPaletteMap(canvas, palette, composition, colorNumber, showContours);
    }
  }, [colorNumber, composition, palette, showContours]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) {
      onDownloadError(t("palette.canvasUnavailable"));
      return;
    }

    try {
      canvas.toBlob((blob) => {
        if (!blob) {
          onDownloadError(t("palette.pngUnsupported"));
          return;
        }

        let url: string | null = null;
        try {
          url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = downloadFilename;
          document.body.append(link);
          link.click();
          link.remove();
          window.setTimeout(() => {
            if (url) URL.revokeObjectURL(url);
          }, 1000);
        } catch (downloadError: unknown) {
          if (url) URL.revokeObjectURL(url);
          onDownloadError(downloadError instanceof Error
            ? t("palette.pngDownloadError", { details: downloadError.message })
            : t("palette.pngDownloadFailed"));
        }
      }, "image/png");
    } catch (downloadError: unknown) {
      onDownloadError(downloadError instanceof Error
        ? t("palette.pngExportError", { details: downloadError.message })
        : t("palette.pngExportFailed"));
    }
  }

  return (
    <>
      <div className="relative grid place-items-center overflow-hidden bg-stone-100">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={label}
          className="block h-auto max-h-80 w-full object-contain"
        />
      </div>
      <div className="flex justify-end border-t border-stone-100 px-3 py-2">
        <button
          type="button"
          onClick={handleDownload}
          aria-label={downloadLabel}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
        >
          {t("palette.download")}
        </button>
      </div>
    </>
  );
}

export function PaletteWorkspace({
  project,
  assets,
  composition,
  client,
  preferences,
  onPreferencesChange,
  paintPreferences,
  onPaintPreferencesChange,
}: {
  project: Project;
  assets: ProjectAsset[];
  composition: CompositionPlan;
  client: ImageProcessingClient | null;
  preferences: ProjectWorkspace["palette"];
  onPreferencesChange: (update: Partial<ProjectWorkspace["palette"]>) => void;
  paintPreferences: ProjectWorkspace["paint"];
  onPaintPreferencesChange: (update: Partial<ProjectWorkspace["paint"]>) => void;
}) {
  const { t, i18n } = useTranslation();
  const { sourceRole, requestedColors, showContours } = preferences;
  const [palette, setPalette] = useState<PaletteExtraction | null>(null);
  const [status, setStatus] = useState("");
  const [persistenceStatus, setPersistenceStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const taskRef = useRef<ReturnType<ImageProcessingClient["startPaletteExtraction"]> | null>(null);
  const generationRef = useRef(0);
  const mapSaveGenerationRef = useRef(0);
  const storageProject = useMemo(
    () => ({ id: project.id, storage: project.storage }),
    [project.id, project.storage],
  );
  const activeAreaKey = getCompositionCropKey(composition);
  const selectedAsset = assets.find((asset) => asset.role === sourceRole);

  useEffect(() => () => {
    generationRef.current += 1;
    taskRef.current?.cancel();
  }, []);

  useEffect(() => {
    let active = true;
    const generation = generationRef.current;
    setPalette(null);
    setStatus("");
    paletteRepository.listForProject(storageProject.id)
      .then((records) => {
        if (!active || generationRef.current !== generation) return;
        const latest = records.find((record) => assets.some((asset) => (
          asset.id === record.assetId
          && assetRevision(asset) === record.assetRevision
          && record.palette.activeAreaKey === activeAreaKey
        )));
        const hasPaletteForCurrentAssets = records.some((record) => assets.some((asset) => (
          asset.id === record.assetId
          && assetRevision(asset) === record.assetRevision
        )));
        if (!latest) {
          if (hasPaletteForCurrentAssets) setStatus(t("palette.activeAreaChanged"));
          return;
        }
        onPreferencesChange({
          sourceRole: latest.sourceRole,
          requestedColors: latest.requestedColors,
        });
        setPalette(latest.palette);
        setStatus(t("palette.loaded", { count: latest.palette.colors.length }));
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error
            ? t("palette.loadError", { details: loadError.message })
            : t("palette.loadError"));
        }
      });
    return () => {
      active = false;
    };
  }, [activeAreaKey, assets, onPreferencesChange, storageProject.id, t]);

  useEffect(() => {
    const currentPalette = palette;
    if (!currentPalette) return;
    const generation = mapSaveGenerationRef.current + 1;
    mapSaveGenerationRef.current = generation;
    let active = true;

    async function saveMaps(paletteToSave: PaletteExtraction) {
      if (storageProject.storage.mode !== "filesystem") {
        setPersistenceStatus(t("palette.localOnly"));
        return;
      }

      try {
        const prefix = `${sourceRole}-`;
        const suffix = `-${String(paletteToSave.requestedColors).padStart(2, "0")}.png`;
        const files = await Promise.all([
          renderPaletteMapBlob(paletteToSave, composition, undefined, showContours)
            .then((blob) => ({
              name: `${prefix}szamozott-szinpaletta${suffix}`,
              blob,
            })),
          ...paletteToSave.colors.map((color) => renderPaletteMapBlob(
            paletteToSave,
            composition,
            color.number,
            showContours,
          ).then((blob) => ({
            name: `${prefix}palettaszin-${String(color.number).padStart(2, "0")}-${color.hex.slice(1)}${suffix}`,
            blob,
          }))),
        ]);
        if (!active || mapSaveGenerationRef.current !== generation) return;
        const saved = await assetStorage.savePaletteMaps(storageProject, files);
        if (!active || mapSaveGenerationRef.current !== generation) return;
        setError(null);
        setPersistenceStatus(saved
          ? t("palette.mapsSaved", { count: files.length })
          : t("palette.noFolder"));
      } catch (saveError: unknown) {
        if (!active || mapSaveGenerationRef.current !== generation) return;
        setError(saveError instanceof Error
          ? t("palette.mapsError", { details: saveError.message })
          : t("palette.mapsFailed"));
      }
    }

    void saveMaps(currentPalette);
    return () => {
      active = false;
    };
  }, [composition, palette, showContours, sourceRole, storageProject, t]);

  function clearPalette() {
    setPalette(null);
    setStatus("");
    setPersistenceStatus("");
    setError(null);
  }

  async function handleExtractPalette() {
    if (!selectedAsset) {
      setError(t("palette.uploadRequired"));
      return;
    }
    if (!client) {
      setError(t("palette.notReady"));
      return;
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setPalette(null);
    setError(null);
    setBusy(true);
    setStatus(t("palette.starting"));

    try {
      const source = await assetStorage.readAsset(storageProject, selectedAsset);
      if (!source) {
        throw new Error(t("palette.missingSource"));
      }
      if (generationRef.current !== generation) return;

      const task = client.startPaletteExtraction(
        {
          assetId: selectedAsset.id,
          assetRevision: assetRevision(selectedAsset),
          source,
        },
        requestedColors,
        selectedAsset.width && selectedAsset.height
          ? getActiveFrameBounds(selectedAsset.width, selectedAsset.height, composition)
          : { x: 0, y: 0, width: 1, height: 1 },
        activeAreaKey,
        (progress) => {
          if (generationRef.current === generation) {
            const label = t(progressKeys[progress.stage]);
            setStatus(progress.total > 0
              ? `${label} · ${progress.completed}/${progress.total}`
              : label);
          }
        },
      );
      taskRef.current = task;
      const result = await task.result;
      if (generationRef.current !== generation) return;
      setPalette(result);
      setStatus(t("palette.created", { count: result.colors.length }));
      setPersistenceStatus(t("palette.saving"));
      await paletteRepository.save(storageProject.id, sourceRole, result);
      if (generationRef.current !== generation) return;
      setPersistenceStatus(t("palette.saved"));
    } catch (paletteError: unknown) {
      if (generationRef.current === generation) {
        setError(paletteError instanceof Error
          ? paletteError.message
          : t("palette.createError"));
        setStatus("");
      }
    } finally {
      if (generationRef.current === generation) {
        taskRef.current = null;
        setBusy(false);
        setPersistenceStatus("");
      }
    }
  }

  function handleSourceChange(role: AssetRole) {
    onPreferencesChange({ sourceRole: role });
    clearPalette();
  }

  function handlePaletteSizeChange(size: PaletteSize) {
    onPreferencesChange({ requestedColors: size });
    clearPalette();
  }

  return (
    <>
      <section
        id="step-palette"
        aria-labelledby="palette-heading"
        className="rounded-2xl border border-stone-200 bg-white/85 p-6 shadow-sm"
      >
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
          {t("palette.eyebrow")}
        </p>
        <h2 id="palette-heading" className="mt-2 text-xl font-semibold">
          {t("palette.heading")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-500">
          {t("palette.description")}
        </p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <label className="grid gap-1.5 text-xs font-medium text-stone-600">
          {t("palette.source")}
          <select
            value={sourceRole}
            onChange={(event) => handleSourceChange(event.target.value as AssetRole)}
            disabled={busy}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 disabled:opacity-60"
          >
            <option value="reference" disabled={!assets.some((asset) => asset.role === "reference")}>
              {t("roles.reference")}
            </option>
            <option value="artwork" disabled={!assets.some((asset) => asset.role === "artwork")}>
              {t("roles.artwork")}
            </option>
          </select>
        </label>
        <label className="grid gap-1.5 text-xs font-medium text-stone-600">
          {t("palette.colors")}
          <select
            value={requestedColors}
            onChange={(event) => handlePaletteSizeChange(Number(event.target.value) as PaletteSize)}
            disabled={busy}
            className="rounded-lg border border-stone-200 bg-white px-3 py-2.5 text-sm text-stone-800 disabled:opacity-60"
          >
            {paletteSizes.map((size) => (
              <option key={size} value={size}>{t("palette.colorCount", { count: size })}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void handleExtractPalette()}
          disabled={!selectedAsset || !client || busy}
          className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? t("palette.making") : t("palette.make")}
        </button>
      </div>

      {!selectedAsset && (
        <p role="status" className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {t("palette.uploadRequired")}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}
      <p role="status" aria-live="polite" className="mt-4 min-h-5 text-xs text-stone-500">
        {status}
      </p>
      {persistenceStatus && (
        <p role="status" aria-live="polite" className="mt-1 text-xs text-stone-500">
          {persistenceStatus}
        </p>
      )}

      {palette && (
        <div className="mt-5 space-y-6">
          <div className="flex flex-col justify-between gap-3 border-t border-stone-100 pt-5 sm:flex-row sm:items-center">
            <p className="text-xs leading-5 text-stone-500">
              {t("palette.sizeHelp")}
            </p>
            <label className="inline-flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={showContours}
                onChange={(event) => onPreferencesChange({ showContours: event.target.checked })}
                className="size-4 accent-emerald-800"
              />
              {t("palette.showContours")}
            </label>
          </div>

          <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {palette.colors.map((color) => (
              <li
                key={color.number}
                className="flex min-w-0 items-center gap-3 rounded-lg border border-stone-200 bg-white p-3"
              >
                <span
                  aria-hidden="true"
                  className="size-9 shrink-0 rounded-md border border-black/10"
                  style={{ backgroundColor: color.hex }}
                />
                <span className="min-w-0 text-xs leading-5 text-stone-700">
                  <strong className="block">{color.number} · {color.hex}</strong>
                  <span>
                    {percentage(color.pixelCount, palette.width * palette.height, i18n.language)}
                    {" · "}{color.pixelCount.toLocaleString(i18n.language)} {t("palette.pixels")}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <figure className="overflow-hidden rounded-xl border border-stone-200 bg-white">
            <figcaption className="border-b border-stone-100 px-4 py-3 text-sm font-semibold text-stone-800">
              {t("palette.numberedMap")}
            </figcaption>
            <PaletteCanvas
              palette={palette}
              composition={composition}
              label={t("palette.numberedMapAlt", { count: palette.colors.length })}
              showContours={showContours}
              downloadFilename="szamozott-szinpaletta.png"
              downloadLabel={t("palette.downloadNumbered")}
              onDownloadError={setError}
            />
          </figure>

          <div>
            <h3 className="text-base font-semibold text-stone-800">{t("palette.perColorMaps")}</h3>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              {t("palette.perColorDescription")}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {palette.colors.map((color) => (
                <figure key={color.number} className="overflow-hidden rounded-xl border border-stone-200 bg-white">
                  <figcaption className="px-3 py-3 text-xs leading-5 text-stone-700">
                    <strong className="block">{color.number} · {color.hex}</strong>
                    <span>
                      {percentage(color.pixelCount, palette.width * palette.height, i18n.language)}
                      {" · "}{color.pixelCount.toLocaleString(i18n.language)} {t("palette.pixels")}
                    </span>
                  </figcaption>
                  <PaletteCanvas
                    palette={palette}
                    composition={composition}
                    colorNumber={color.number}
                    label={t("palette.perColorMapAlt", { number: color.number })}
                    showContours={showContours}
                    downloadFilename={`palettaszin-${String(color.number).padStart(2, "0")}-${color.hex.slice(1).toUpperCase()}.png`}
                    downloadLabel={t("palette.downloadColor", { number: color.number })}
                    onDownloadError={setError}
                  />
                </figure>
              ))}
            </div>
          </div>
        </div>
      )}
      </section>
      <PaintPlanningWorkspace
        project={project}
        palette={palette}
        preferences={paintPreferences}
        onPreferencesChange={onPaintPreferencesChange}
      />
    </>
  );
}
