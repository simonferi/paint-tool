import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18nInstance from "../../i18n";
import type { CompositionPlan, Project, ProjectAsset } from "../../domain";
import { assetStorage } from "../../storage";
import { drawCompositionPreview } from "./geometry";

export function CompositionPreview({
  project,
  asset,
  plan,
}: {
  project: Project;
  asset?: ProjectAsset;
  plan: CompositionPlan;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState("");
  const storageProject = useMemo(
    () => ({ id: project.id, storage: project.storage }),
    [project.id, project.storage],
  );

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;
    setImage(null);
    setStatus("");
    if (!asset) return () => { active = false; };

    assetStorage.readAsset(storageProject, asset)
      .then((blob) => {
        if (!active) return;
        if (!blob) {
          setStatus(i18nInstance.t("composition.imageUnavailable"));
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        const loadedImage = new Image();
        loadedImage.onload = () => {
          if (active) setImage(loadedImage);
        };
        loadedImage.onerror = () => {
          if (active) setStatus(i18nInstance.t("images.openError"));
        };
        loadedImage.src = objectUrl;
      })
      .catch((error: unknown) => {
        if (active) {
          setStatus(error instanceof Error ? error.message : i18nInstance.t("images.loadError"));
        }
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset, storageProject]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const render = () => drawCompositionPreview(canvas, image, plan);
    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas.parentElement ?? canvas);
    return () => observer.disconnect();
  }, [image, plan]);

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex items-center justify-between text-xs font-semibold text-stone-700">
        <span>{asset ? t(asset.role === "reference" ? "roles.reference" : "roles.artwork") : t("composition.previewNoImage")}</span>
        {asset?.width && asset.height && (
          <span className="font-normal text-stone-500">{asset.width} × {asset.height} px</span>
        )}
      </figcaption>
      <div className="grid h-56 place-items-center overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
        {asset ? (
          <canvas
            ref={canvasRef}
            className="block h-full w-full"
            aria-label={t(
              asset.role === "reference" ? "composition.referencePreview" : "composition.artworkPreview",
            )}
          />
        ) : (
          <p className="px-4 text-center text-xs text-stone-500">{t("composition.previewUpload")}</p>
        )}
      </div>
      {status && <p role="status" className="mt-2 text-xs text-amber-700">{status}</p>}
    </figure>
  );
}
