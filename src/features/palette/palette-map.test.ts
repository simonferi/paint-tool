import { describe, expect, it } from "vitest";
import { defaultCompositionPlan } from "../../domain";
import { extractPaletteRgba } from "../../image-processing/palette";
import {
  createActivePaletteView,
  createPaletteMapPixels,
  getPaletteMarkerPositions,
} from "./palette-map";

function createTwoColorPalette() {
  return extractPaletteRgba({
    assetId: "asset-map" as never,
    assetRevision: "revision-map" as never,
    width: 4,
    height: 1,
    requestedColors: 4,
    pixels: new Uint8ClampedArray([
      240, 20, 20, 255,
      240, 20, 20, 255,
      20, 30, 240, 255,
      20, 30, 240, 255,
    ]),
  });
}

function createFourByFourPalette() {
  return extractPaletteRgba({
    assetId: "asset-map-square" as never,
    assetRevision: "revision-map-square" as never,
    width: 4,
    height: 4,
    requestedColors: 4,
    pixels: new Uint8ClampedArray(Array.from({ length: 16 }, (_, index) => {
      const isRed = index % 4 < 2;
      return isRed
        ? [240, 20, 20, 255]
        : [20, 30, 240, 255];
    }).flat()),
  });
}

describe("palette map rendering data", () => {
  it("uses discrete palette colors in the numbered map", () => {
    const palette = createTwoColorPalette();
    const pixels = createPaletteMapPixels(palette);

    for (let index = 0; index < palette.labelMap.length; index += 1) {
      const color = palette.colors[palette.labelMap[index]];
      expect(Array.from(pixels.slice(index * 4, index * 4 + 3))).toEqual([
        color.red,
        color.green,
        color.blue,
      ]);
    }
  });

  it("fades the source, hatches the selected color, and outlines its boundary", () => {
    const palette = createTwoColorPalette();
    const red = palette.colors.find((color) => color.red > color.blue);
    if (!red) throw new Error("Red palette color missing from test fixture.");

    const region = createPaletteMapPixels(palette, red.number);
    const redIndex = palette.colors.indexOf(red);
    const redPixel = palette.labelMap.findIndex((label) => label === redIndex);
    const bluePixel = palette.labelMap.findIndex((label) => label !== redIndex);
    expect(Array.from(region.slice(redPixel * 4, redPixel * 4 + 3))).toEqual([22, 61, 50]);
    expect(region[bluePixel * 4]).toBeGreaterThan(180);

    const outlined = createPaletteMapPixels(palette, red.number, true);
    const borderPixel = redIndex === palette.labelMap[1] ? 1 : 2;
    expect(Array.from(outlined.slice(borderPixel * 4, borderPixel * 4 + 3))).toEqual([26, 39, 34]);
  });

  it("provides one readable marker position per palette color", () => {
    const palette = createTwoColorPalette();
    expect(getPaletteMarkerPositions(palette)).toHaveLength(palette.colors.length);
  });

  it("renders a crop map at the selected active frame size", () => {
    const palette = createFourByFourPalette();
    const view = createActivePaletteView(palette, {
      ...defaultCompositionPlan,
      aspect: "1:1",
      crop: { mode: "crop", scale: 0.5, offsetX: 1, offsetY: 0 },
    });

    expect(view.width).toBe(2);
    expect(view.height).toBe(2);
    expect(view.activeMask?.every((value) => value === 1)).toBe(true);
  });

  it("renders canvas expansion with white pixels outside the source image", () => {
    const palette = createFourByFourPalette();
    const view = createActivePaletteView(palette, {
      ...defaultCompositionPlan,
      aspect: "1:1",
      crop: { mode: "canvas", scale: 1.5, offsetX: 0, offsetY: 0 },
    });
    const pixels = createPaletteMapPixels(view);

    expect(view.width).toBe(6);
    expect(view.height).toBe(6);
    expect(view.activeMask?.[0]).toBe(0);
    expect(Array.from(pixels.slice(0, 3))).toEqual([255, 255, 255]);
    expect(view.activeMask?.[view.width * 3 + 3]).toBe(1);
  });
});
