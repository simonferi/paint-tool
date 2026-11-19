import { describe, expect, it } from "vitest";
import { analyzeRgba } from "./analysis";

describe("analyzeRgba", () => {
  it("composites transparent pixels over white", () => {
    const result = analyzeRgba({
      assetId: "asset-transparent" as never,
      assetRevision: "revision-transparent" as never,
      width: 1,
      height: 1,
      pixels: new Uint8ClampedArray([0, 0, 0, 0]),
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(result.tone.mean).toBeCloseTo(255);
    expect(result.tone.bins).toEqual([0, 0, 0, 0, 1]);
  });

  it("calculates mean luminance and five tone bins", () => {
    const result = analyzeRgba({
      assetId: "asset-1" as never,
      assetRevision: "revision-1" as never,
      width: 5,
      height: 1,
      pixels: new Uint8ClampedArray([
        0, 0, 0, 255,
        60, 60, 60, 255,
        120, 120, 120, 255,
        180, 180, 180, 255,
        255, 255, 255, 255,
      ]),
      now: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(result.tone.bins).toEqual([1, 1, 1, 1, 1]);
    expect(result.tone.mean).toBeCloseTo(123);
    expect(result.aspectRatio).toBe(5);
  });
});
