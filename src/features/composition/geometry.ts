import type { CompositionPlan } from "../../domain";

export type Bounds = {
  x: number;
  y: number;
  width: number;
  height: number;
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
): void {
  const guideBounds = getGuideBounds(imageBounds, getTargetRatio(plan));
  if (guideBounds.x !== imageBounds.x || guideBounds.y !== imageBounds.y
    || guideBounds.width !== imageBounds.width || guideBounds.height !== imageBounds.height) {
    context.save();
    context.fillStyle = "rgb(22 27 24 / 28%)";
    context.fillRect(imageBounds.x, imageBounds.y, imageBounds.width, guideBounds.y - imageBounds.y);
    context.fillRect(
      imageBounds.x,
      guideBounds.y + guideBounds.height,
      imageBounds.width,
      imageBounds.y + imageBounds.height - guideBounds.y - guideBounds.height,
    );
    context.fillRect(imageBounds.x, guideBounds.y, guideBounds.x - imageBounds.x, guideBounds.height);
    context.fillRect(
      guideBounds.x + guideBounds.width,
      guideBounds.y,
      imageBounds.x + imageBounds.width - guideBounds.x - guideBounds.width,
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
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const imageBounds = {
    x: (width - image.naturalWidth * scale) / 2,
    y: (height - image.naturalHeight * scale) / 2,
    width: image.naturalWidth * scale,
    height: image.naturalHeight * scale,
  };
  context.drawImage(image, imageBounds.x, imageBounds.y, imageBounds.width, imageBounds.height);
  drawCompositionGuides(context, imageBounds, plan);
}
