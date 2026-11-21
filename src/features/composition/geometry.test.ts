import { describe, expect, it } from "vitest";
import {
  compositionSummary,
  getActiveFrameBounds,
  getCompositionCropKey,
  getCropFrameBounds,
  getGridGeometry,
  getGuideBounds,
  getPreviewLayout,
} from "./geometry";
import { defaultCompositionPlan } from "../../domain";

describe("composition geometry", () => {
  it("calculates a centered custom aspect frame", () => {
    const frame = getGuideBounds(
      { x: 0, y: 0, width: 300, height: 300 },
      3 / 2,
    );
    expect(frame).toEqual({ x: 0, y: 50, width: 300, height: 200 });
  });

  it("calculates custom grid spacing from planned canvas size", () => {
    const plan = {
      ...defaultCompositionPlan,
      widthCm: 30,
      heightCm: 24,
      grid: { ...defaultCompositionPlan.grid, mode: "custom" as const, columns: 10, rows: 6 },
    };
    expect(compositionSummary(plan)).toEqual({
      type: "grid",
      columns: 10,
      rows: 6,
      widthSpacing: 3,
      heightSpacing: 4,
    });
  });

  it("uses width for vertical spacing and height for horizontal spacing on a 30 by 40 canvas", () => {
    const plan = {
      ...defaultCompositionPlan,
      widthCm: 30,
      heightCm: 40,
      grid: { ...defaultCompositionPlan.grid, mode: "thirds" as const },
    };

    expect(compositionSummary(plan)).toEqual({
      type: "grid",
      columns: 3,
      rows: 3,
      widthSpacing: 10,
      heightSpacing: 40 / 3,
    });
  });

  it("places metric grid lines at fixed centimeter intervals", () => {
    const plan = {
      ...defaultCompositionPlan,
      widthCm: 30,
      heightCm: 24,
      grid: { ...defaultCompositionPlan.grid, mode: "metric" as const, cellCm: 4 },
    };
    const grid = getGridGeometry({ x: 0, y: 0, width: 300, height: 240 }, plan);
    expect(grid.vertical).toHaveLength(7);
    expect(grid.horizontal).toHaveLength(5);
    expect(grid.vertical[0]).toBeCloseTo(40);
    expect(grid.horizontal[0]).toBeCloseTo(40);
  });

  it("keeps a reduced crop frame inside the reference and applies normalized offsets", () => {
    const frame = getCropFrameBounds(
      { x: 0, y: 0, width: 400, height: 300 },
      4 / 3,
      { mode: "crop", scale: 0.5, offsetX: 1, offsetY: -1 },
    );

    expect(frame.width).toBeCloseTo(200);
    expect(frame.height).toBeCloseTo(150);
    expect(frame.x).toBeCloseTo(200);
    expect(frame.y).toBeCloseTo(0);
  });

  it("allows an enlarged canvas frame to surround the reference", () => {
    const frame = getCropFrameBounds(
      { x: 0, y: 0, width: 400, height: 300 },
      4 / 3,
      { mode: "canvas", scale: 1.5, offsetX: 0, offsetY: 0 },
    );

    expect(frame.width).toBeCloseTo(600);
    expect(frame.height).toBeCloseTo(450);
    expect(frame.x).toBeCloseTo(-100);
    expect(frame.y).toBeCloseTo(-75);
  });

  it("starts canvas mode with a frame that contains a differently shaped reference", () => {
    const frame = getCropFrameBounds(
      { x: 0, y: 0, width: 400, height: 300 },
      1,
      { mode: "canvas", scale: 1, offsetX: 0, offsetY: 0 },
    );

    expect(frame).toMatchObject({ x: 0, y: -50, width: 400, height: 400 });
    expect(frame.y).toBeLessThanOrEqual(0);
    expect(frame.y + frame.height).toBeGreaterThanOrEqual(300);
  });

  it("fits both the image and an enlarged canvas frame in the interactive preview", () => {
    const layout = getPreviewLayout(
      300,
      200,
      400,
      300,
      {
        ...defaultCompositionPlan,
        aspect: "4:3",
        crop: { mode: "canvas", scale: 1.5, offsetX: 0, offsetY: 0 },
      },
    );

    expect(layout.frameBounds.width).toBeLessThanOrEqual(284);
    expect(layout.frameBounds.height).toBeLessThanOrEqual(184);
    expect(layout.imageBounds.width).toBeLessThan(layout.frameBounds.width);
  });

  it("creates a stable active-area identity and source region", () => {
    const plan = {
      ...defaultCompositionPlan,
      aspect: "1:1" as const,
      crop: { mode: "crop" as const, scale: 0.5, offsetX: 1, offsetY: 0 },
    };
    expect(getCompositionCropKey(plan)).toBe("1:1:::crop:0.5:1:0");
    expect(getActiveFrameBounds(400, 400, plan)).toEqual({
      x: 200,
      y: 100,
      width: 200,
      height: 200,
    });
  });
});
