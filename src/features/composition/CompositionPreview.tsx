import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import i18nInstance from "../../i18n";
import type { CompositionCrop, CompositionPlan, Project, ProjectAsset } from "../../domain";
import { assetStorage } from "../../storage";
import { drawCompositionPreview, getPreviewLayout, getTargetRatio, type PreviewLayout } from "./geometry";

type Interaction =
  | {
    kind: "move";
    pointerId: number;
    startX: number;
    startY: number;
    initialCrop: CompositionCrop;
  }
  | {
    kind: "resize";
    pointerId: number;
    startX: number;
    startY: number;
    initialCrop: CompositionCrop;
    direction: { x: -1 | 1; y: -1 | 1 };
  };

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function getScaleLimits(mode: CompositionCrop["mode"]): [number, number] {
  return mode === "crop" ? [0.25, 1] : [1, 2.5];
}

export function CompositionPreview({
  project,
  asset,
  plan,
  onCropFrameChange,
}: {
  project: Project;
  asset?: ProjectAsset;
  plan: CompositionPlan;
  onCropFrameChange?: (crop: CompositionCrop) => void;
}) {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<Interaction | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [status, setStatus] = useState("");
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
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
    const container = containerRef.current;
    if (!container) return;
    const updateViewport = () => {
      const rect = container.getBoundingClientRect();
      setViewport({ width: rect.width, height: rect.height });
    };
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo<PreviewLayout | null>(() => {
    if (!image || viewport.width <= 0 || viewport.height <= 0) return null;
    return getPreviewLayout(
      viewport.width,
      viewport.height,
      image.naturalWidth,
      image.naturalHeight,
      plan,
    );
  }, [image, plan, viewport]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const render = () => drawCompositionPreview(canvas, image, plan);
    render();
  }, [image, plan]);

  function startInteraction(
    event: PointerEvent<HTMLDivElement | HTMLButtonElement>,
    kind: Interaction["kind"],
    direction?: { x: -1 | 1; y: -1 | 1 },
  ) {
    if (!onCropFrameChange || !layout || !getTargetRatio(plan)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = kind === "move"
      ? {
        kind,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        initialCrop: plan.crop,
      }
      : {
        kind,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        initialCrop: plan.crop,
        direction: direction ?? { x: 1, y: 1 },
      };
  }

  function updateInteraction(event: PointerEvent<HTMLDivElement>) {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId || !onCropFrameChange || !layout) return;
    const deltaX = event.clientX - interaction.startX;
    const deltaY = event.clientY - interaction.startY;
    if (interaction.kind === "move") {
      onCropFrameChange({
        ...interaction.initialCrop,
        offsetX: layout.movementRangeX > 0
          ? clamp(interaction.initialCrop.offsetX + deltaX / layout.movementRangeX, -1, 1)
          : interaction.initialCrop.offsetX,
        offsetY: layout.movementRangeY > 0
          ? clamp(interaction.initialCrop.offsetY + deltaY / layout.movementRangeY, -1, 1)
          : interaction.initialCrop.offsetY,
      });
      return;
    }

    const projectedDelta = (
      deltaX * interaction.direction.x + deltaY * interaction.direction.y
    ) / 2;
    const averageFrameSize = Math.max(1, (layout.frameBounds.width + layout.frameBounds.height) / 2);
    const [minimum, maximum] = getScaleLimits(interaction.initialCrop.mode);
    onCropFrameChange({
      ...interaction.initialCrop,
      scale: clamp(
        interaction.initialCrop.scale * (1 + projectedDelta / averageFrameSize),
        minimum,
        maximum,
      ),
    });
  }

  function finishInteraction(event: PointerEvent<HTMLDivElement>) {
    if (interactionRef.current?.pointerId === event.pointerId) {
      interactionRef.current = null;
    }
  }

  const interactive = Boolean(onCropFrameChange && layout && getTargetRatio(plan));
  const frameStyle = layout ? {
    left: layout.frameBounds.x,
    top: layout.frameBounds.y,
    width: layout.frameBounds.width,
    height: layout.frameBounds.height,
  } : undefined;

  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 flex items-center justify-between text-xs font-semibold text-stone-700">
        <span>{asset ? t(asset.role === "reference" ? "roles.reference" : "roles.artwork") : t("composition.previewNoImage")}</span>
        {asset?.width && asset.height && (
          <span className="font-normal text-stone-500">{asset.width} × {asset.height} px</span>
        )}
      </figcaption>
      <div
        ref={containerRef}
        className="relative grid h-56 place-items-center overflow-hidden rounded-lg border border-stone-200 bg-stone-100"
        onPointerMove={updateInteraction}
        onPointerUp={finishInteraction}
        onPointerCancel={finishInteraction}
      >
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
        {layout && (
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden={!interactive}
          >
            <div
              className={`absolute border-2 border-emerald-300 shadow-[0_0_0_1px_rgba(22,28,24,0.65)] ${
                interactive ? "pointer-events-auto cursor-move" : ""
              }`}
              style={frameStyle}
              onPointerDown={(event) => startInteraction(event, "move")}
            >
              {interactive && (
                <>
                  {([
                    ["nw", -1, -1],
                    ["ne", 1, -1],
                    ["sw", -1, 1],
                    ["se", 1, 1],
                  ] as const).map(([position, x, y]) => (
                    <button
                      key={position}
                      type="button"
                      aria-label={t("composition.resizeHandle", { position })}
                      className={`pointer-events-auto absolute h-3 w-3 rounded-sm border border-white bg-emerald-700 shadow ${
                        position === "nw" ? "-left-1.5 -top-1.5" :
                          position === "ne" ? "-right-1.5 -top-1.5" :
                            position === "sw" ? "-bottom-1.5 -left-1.5" : "-bottom-1.5 -right-1.5"
                      }`}
                      onPointerDown={(event) => startInteraction(event, "resize", { x, y })}
                    />
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {status && <p role="status" className="mt-2 text-xs text-amber-700">{status}</p>}
    </figure>
  );
}
