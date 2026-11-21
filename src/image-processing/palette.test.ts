import { describe, expect, it } from "vitest";
import { extractPaletteRgba } from "./palette";

describe("extractPaletteRgba", () => {
  it("creates a compact palette, pixel labels, and region counts", () => {
    const pixels = new Uint8ClampedArray([
      240, 20, 20, 255,
      240, 20, 20, 255,
      20, 30, 240, 255,
      20, 30, 240, 255,
    ]);
    const result = extractPaletteRgba({
      assetId: "asset-palette" as never,
      assetRevision: "revision-palette" as never,
      width: 2,
      height: 2,
      requestedColors: 4,
      pixels,
    });

    expect(result.colors).toHaveLength(2);
    expect(result.colors.map((color) => color.number)).toEqual([1, 2]);
    expect(result.colors.reduce((sum, color) => sum + color.pixelCount, 0)).toBe(4);
    expect(Array.from(result.labelMap)).toEqual([1, 1, 0, 0]);
    expect(result.sourcePixels[3]).toBe(255);
    expect(result.id).toContain(":4");
    expect(result.activeAreaKey).toBe("full");
  });

  it("composites transparent pixels over white", () => {
    const result = extractPaletteRgba({
      assetId: "asset-alpha" as never,
      assetRevision: "revision-alpha" as never,
      width: 1,
      height: 1,
      requestedColors: 6,
      pixels: new Uint8ClampedArray([0, 0, 0, 0]),
    });

    expect(result.colors).toHaveLength(1);
    expect(result.colors[0].hex).toBe("#FFFFFF");
    expect(Array.from(result.sourcePixels)).toEqual([255, 255, 255, 255]);
  });

  it("rejects malformed image data", () => {
    expect(() => extractPaletteRgba({
      assetId: "asset-invalid" as never,
      assetRevision: "revision-invalid" as never,
      width: 2,
      height: 2,
      requestedColors: 5,
      pixels: new Uint8ClampedArray(4),
    })).toThrow("érvényes RGBA");
  });
});
