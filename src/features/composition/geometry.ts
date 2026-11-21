import type { CompositionCrop, CompositionPlan } from "../../domain";

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PreviewLayout = {
  imageBounds: Bounds;
  frameBounds: Bounds;
  movementRangeX: number;
  movementRangeY: number;
};

export type GeometryMessageKey =
  | "composition.errors.metricSettings"
  | "composition.errors.gridTooDense"
  | "composition.errors.customGrid"
  | "composition.errors.customAspect";

export type GridGeometry = {
  vertical: number[];
  horizontal: number[];
  diagonals: boolean;
  error?: GeometryMessageKey;
};

export type CompositionSummary =
  | { type: "error"; message: GeometryMessageKey }
  | { type: "none" }
  | { type: "diagonals" }
  | { type: "metric"; cellCm: number; verticalCount: number; horizontalCount: number }
  | {
    type: "grid";
    columns: number;
    rows: number;
    widthSpacing: number | null;
    heightSpacing: number | null;
  };

const compositionErrors = {
  metricSettings: "composition.errors.metricSettings",
  gridTooDense: "composition.errors.gridTooDense",
  customGrid: "composition.errors.customGrid",
  customAspect: "composition.errors.customAspect",
} as const satisfies Record<string, GeometryMessageKey>;

const standardDivisions: Record<string, number> = {
  thirds: 3,
  quarters: 4,
  "6x6": 6,
  "8x8": 8,
  "10x10": 10,
};

export function getTargetRatio(plan: CompositionPlan): number | null {
  if (plan.aspect === "free") return null;
  if (plan.aspect === "custom") {
    if (!plan.widthCm || !plan.heightCm) return null;
    return plan.widthCm / plan.heightCm;
  }
  const [width, height] = plan.aspect.split(":").map(Number);
  return width / height;
}

export function getGuideBounds(bounds: Bounds, targetRatio: number | null): Bounds {
  if (!targetRatio || !Number.isFinite(targetRatio) || targetRatio <= 0) return bounds;
  const imageRatio = bounds.width / bounds.height;
  const frameWidth = targetRatio > imageRatio ? bounds.width : bounds.height * targetRatio;
  const frameHeight = targetRatio > imageRatio ? bounds.width / targetRatio : bounds.height;
  return {
    x: bounds.x + (bounds.width - frameWidth) / 2,
    y: bounds.y + (bounds.height - frameHeight) / 2,
    width: frameWidth,
    height: frameHeight,
  };
}

function getCanvasBounds(bounds: Bounds, targetRatio: number): Bounds {
  const imageRatio = bounds.width / bounds.height;
  const frameWidth = targetRatio > imageRatio ? bounds.height * targetRatio : bounds.width;
  const frameHeight = targetRatio > imageRatio ? bounds.height : bounds.width / targetRatio;
  return {
    x: bounds.x + (bounds.width - frameWidth) / 2,
    y: bounds.y + (bounds.height - frameHeight) / 2,
    width: frameWidth,
    height: frameHeight,
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function getCropScale(crop: CompositionCrop, targetRatio: number | null): number {
  if (!targetRatio || !Number.isFinite(targetRatio) || targetRatio <= 0) return 1;
  const minimum = crop.mode === "crop" ? 0.25 : 1;
  const maximum = crop.mode === "crop" ? 1 : 2.5;
  return clamp(crop.scale, minimum, maximum);
}

export function getCropFrameBounds(
  imageBounds: Bounds,
  targetRatio: number | null,
  crop: CompositionCrop,
): Bounds & { movementRangeX: number; movementRangeY: number } {
  if (!targetRatio || !Number.isFinite(targetRatio) || targetRatio <= 0) {
    return { ...imageBounds, movementRangeX: 0, movementRangeY: 0 };
  }

  const baseBounds = crop.mode === "canvas"
    ? getCanvasBounds(imageBounds, targetRatio)
    : getGuideBounds(imageBounds, targetRatio);
  const scale = getCropScale(crop, targetRatio);
  const width = baseBounds.width * scale;
  const height = baseBounds.height * scale;
  const movementRangeX = Math.abs(imageBounds.width - width) / 2;
  const movementRangeY = Math.abs(imageBounds.height - height) / 2;
  const centerX = imageBounds.x + imageBounds.width / 2;
  const centerY = imageBounds.y + imageBounds.height / 2;
  const offsetX = clamp(crop.offsetX, -1, 1);
  const offsetY = clamp(crop.offsetY, -1, 1);

  return {
    x: centerX - width / 2 + offsetX * movementRangeX,
    y: centerY - height / 2 + offsetY * movementRangeY,
    width,
    height,
    movementRangeX,
    movementRangeY,
  };
}

export function getActiveFrameBounds(
  imageWidth: number,
  imageHeight: number,
  plan: CompositionPlan,
): Bounds {
  const frame = getCropFrameBounds(
    { x: 0, y: 0, width: imageWidth, height: imageHeight },
    getTargetRatio(plan),
    plan.crop,
  );
  return {
    x: frame.x,
    y: frame.y,
    width: frame.width,
    height: frame.height,
  };
}

export function getCompositionCropKey(plan: CompositionPlan): string {
  if (!getTargetRatio(plan)) return "full";
  return [
    plan.aspect,
    plan.widthCm ?? "",
    plan.heightCm ?? "",
    plan.crop.mode,
    plan.crop.scale,
    plan.crop.offsetX,
    plan.crop.offsetY,
  ].join(":");
}

export function getPreviewLayout(
  width: number,
  height: number,
  imageWidth: number,
  imageHeight: number,
  plan: CompositionPlan,
): PreviewLayout {
  const logicalImageBounds = { x: 0, y: 0, width: imageWidth, height: imageHeight };
  const logicalFrameBounds = getCropFrameBounds(
    logicalImageBounds,
    getTargetRatio(plan),
    plan.crop,
  );
  const contentLeft = Math.min(logicalImageBounds.x, logicalFrameBounds.x);
  const contentTop = Math.min(logicalImageBounds.y, logicalFrameBounds.y);
  const contentRight = Math.max(
    logicalImageBounds.x + logicalImageBounds.width,
    logicalFrameBounds.x + logicalFrameBounds.width,
  );
  const contentBottom = Math.max(
    logicalImageBounds.y + logicalImageBounds.height,
    logicalFrameBounds.y + logicalFrameBounds.height,
  );
  const contentWidth = Math.max(1, contentRight - contentLeft);
  const contentHeight = Math.max(1, contentBottom - contentTop);
  const scale = Math.min(
    Math.max(1, width - 16) / contentWidth,
    Math.max(1, height - 16) / contentHeight,
  );
  const originX = (width - contentWidth * scale) / 2 - contentLeft * scale;
  const originY = (height - contentHeight * scale) / 2 - contentTop * scale;
  const toScreen = (bounds: Bounds): Bounds => ({
    x: originX + bounds.x * scale,
    y: originY + bounds.y * scale,
    width: bounds.width * scale,
    height: bounds.height * scale,
  });

  return {
    imageBounds: toScreen(logicalImageBounds),
    frameBounds: toScreen(logicalFrameBounds),
    movementRangeX: logicalFrameBounds.movementRangeX * scale,
    movementRangeY: logicalFrameBounds.movementRangeY * scale,
  };
}

export function getGridGeometry(bounds: Bounds, plan: CompositionPlan): GridGeometry {
  const { mode, columns, rows, cellCm } = plan.grid;
  if (mode === "none") {
    return { vertical: [], horizontal: [], diagonals: false };
  }
  if (mode === "diagonals") {
    return { vertical: [bounds.x + bounds.width / 2], horizontal: [bounds.y + bounds.height / 2], diagonals: true };
  }

  if (mode === "metric") {
    const { widthCm, heightCm } = plan;
    if (!widthCm || !heightCm || !cellCm) {
      return {
        vertical: [],
        horizontal: [],
        diagonals: false,
        error: compositionErrors.metricSettings,
      };
    }

    const verticalCount = Math.ceil(widthCm / cellCm) - 1;
    const horizontalCount = Math.ceil(heightCm / cellCm) - 1;
    if (verticalCount > 100 || horizontalCount > 100) {
      return {
        vertical: [],
        horizontal: [],
        diagonals: false,
        error: compositionErrors.gridTooDense,
      };
    }

    const vertical = [];
    const horizontal = [];
    for (let distance = cellCm; distance < widthCm; distance += cellCm) {
      vertical.push(bounds.x + (bounds.width * distance) / widthCm);
    }
    for (let distance = cellCm; distance < heightCm; distance += cellCm) {
      horizontal.push(bounds.y + (bounds.height * distance) / heightCm);
    }
    return { vertical, horizontal, diagonals: false };
  }

  const divisions = mode === "custom"
    ? { columns, rows }
    : { columns: standardDivisions[mode], rows: standardDivisions[mode] };
  if (!Number.isInteger(divisions.columns) || !Number.isInteger(divisions.rows)
    || divisions.columns < 1 || divisions.rows < 1
    || divisions.columns > 100 || divisions.rows > 100) {
    return {
      vertical: [],
      horizontal: [],
      diagonals: false,
      error: compositionErrors.customGrid,
    };
  }

  return {
    vertical: Array.from(
      { length: divisions.columns - 1 },
      (_, index) => bounds.x + (bounds.width * (index + 1)) / divisions.columns,
    ),
    horizontal: Array.from(
      { length: divisions.rows - 1 },
      (_, index) => bounds.y + (bounds.height * (index + 1)) / divisions.rows,
    ),
    diagonals: false,
  };
}

export function validateCompositionPlan(plan: CompositionPlan): GeometryMessageKey[] {
  const errors: GeometryMessageKey[] = [];
  if (plan.aspect === "custom" && (!plan.widthCm || !plan.heightCm)) {
    errors.push(compositionErrors.customAspect);
  }
  if (plan.grid.mode === "custom"
    && (!Number.isInteger(plan.grid.columns) || plan.grid.columns < 1 || plan.grid.columns > 100
      || !Number.isInteger(plan.grid.rows) || plan.grid.rows < 1 || plan.grid.rows > 100)) {
    errors.push(compositionErrors.customGrid);
  }
  if (plan.grid.mode === "metric") {
    if (!plan.widthCm || !plan.heightCm || !plan.grid.cellCm) {
      errors.push(compositionErrors.metricSettings);
    } else if (Math.ceil(plan.widthCm / plan.grid.cellCm) - 1 > 100
      || Math.ceil(plan.heightCm / plan.grid.cellCm) - 1 > 100) {
      errors.push(compositionErrors.gridTooDense);
    }
  }
  return errors;
}

export function compositionSummary(plan: CompositionPlan): CompositionSummary {
  const validationErrors = validateCompositionPlan(plan);
  if (validationErrors.length > 0) return { type: "error", message: validationErrors[0] };
  if (plan.grid.mode === "none") return { type: "none" };
  if (plan.grid.mode === "diagonals") return { type: "diagonals" };

  if (plan.grid.mode === "metric" && plan.widthCm && plan.heightCm && plan.grid.cellCm) {
    return {
      type: "metric",
      cellCm: plan.grid.cellCm,
      verticalCount: Math.ceil(plan.widthCm / plan.grid.cellCm) - 1,
      horizontalCount: Math.ceil(plan.heightCm / plan.grid.cellCm) - 1,
    };
  }

  const columnCount = plan.grid.mode === "custom" ? plan.grid.columns : standardDivisions[plan.grid.mode];
  const rowCount = plan.grid.mode === "custom" ? plan.grid.rows : standardDivisions[plan.grid.mode];
  if (!plan.widthCm || !plan.heightCm) {
    return {
      type: "grid",
      columns: columnCount,
      rows: rowCount,
      widthSpacing: null,
      heightSpacing: null,
    };
  }
  return {
    type: "grid",
    columns: columnCount,
    rows: rowCount,
    widthSpacing: plan.widthCm / columnCount,
    heightSpacing: plan.heightCm / rowCount,
  };
}

export function drawCompositionGuides(
  context: CanvasRenderingContext2D,
  imageBounds: Bounds,
  plan: CompositionPlan,
  viewport: Bounds = imageBounds,
  frameOverride?: Bounds,
): void {
  const guideBounds = frameOverride ?? getCropFrameBounds(imageBounds, getTargetRatio(plan), plan.crop);
  if (guideBounds.x !== viewport.x || guideBounds.y !== viewport.y
    || guideBounds.width !== viewport.width || guideBounds.height !== viewport.height) {
    context.save();
    context.fillStyle = "rgb(22 27 24 / 28%)";
    context.fillRect(viewport.x, viewport.y, viewport.width, Math.max(0, guideBounds.y - viewport.y));
    context.fillRect(
      viewport.x,
      guideBounds.y + guideBounds.height,
      viewport.width,
      Math.max(0, viewport.y + viewport.height - guideBounds.y - guideBounds.height),
    );
    context.fillRect(viewport.x, guideBounds.y, Math.max(0, guideBounds.x - viewport.x), guideBounds.height);
    context.fillRect(
      guideBounds.x + guideBounds.width,
      guideBounds.y,
      Math.max(0, viewport.x + viewport.width - guideBounds.x - guideBounds.width),
      guideBounds.height,
    );
    context.restore();
  }

  const grid = getGridGeometry(guideBounds, plan);
  if (!grid.error && plan.grid.mode !== "none") {
    context.save();
    context.beginPath();
    context.rect(guideBounds.x, guideBounds.y, guideBounds.width, guideBounds.height);
    context.clip();
    context.strokeStyle = "rgb(255 254 246 / 88%)";
    context.lineWidth = 1;
    context.shadowColor = "rgb(22 28 24 / 65%)";
    context.shadowBlur = 2;
    context.beginPath();
    grid.vertical.forEach((x) => {
      context.moveTo(x, guideBounds.y);
      context.lineTo(x, guideBounds.y + guideBounds.height);
    });
    grid.horizontal.forEach((y) => {
      context.moveTo(guideBounds.x, y);
      context.lineTo(guideBounds.x + guideBounds.width, y);
    });
    if (grid.diagonals) {
      context.moveTo(guideBounds.x, guideBounds.y);
      context.lineTo(guideBounds.x + guideBounds.width, guideBounds.y + guideBounds.height);
      context.moveTo(guideBounds.x + guideBounds.width, guideBounds.y);
      context.lineTo(guideBounds.x, guideBounds.y + guideBounds.height);
    }
    context.stroke();
    context.restore();
  }

  context.save();
  context.strokeStyle = "rgb(255 255 247 / 92%)";
  context.lineWidth = 1;
  context.setLineDash([5, 4]);
  context.shadowColor = "rgb(22 28 24 / 65%)";
  context.shadowBlur = 2;
  context.strokeRect(
    guideBounds.x + 0.5,
    guideBounds.y + 0.5,
    Math.max(0, guideBounds.width - 1),
    Math.max(0, guideBounds.height - 1),
  );
  context.restore();
}

export function drawCompositionPreview(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  plan: CompositionPlan,
): void {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  const context = canvas.getContext("2d");
  if (!context) return;

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.fillStyle = "#eae5da";
  context.fillRect(0, 0, width, height);
  const layout = getPreviewLayout(width, height, image.naturalWidth, image.naturalHeight, plan);
  const imageBounds = layout.imageBounds;
  context.drawImage(image, imageBounds.x, imageBounds.y, imageBounds.width, imageBounds.height);
  drawCompositionGuides(context, imageBounds, plan, { x: 0, y: 0, width, height });
}
