import { describe, expect, it } from "vitest";
import { compositionSummary, getGridGeometry, getGuideBounds } from "./geometry";
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
});
