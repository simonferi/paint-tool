import { describe, expect, it } from "vitest";
import {
  calculatePaintConsumption,
  paintColorSchema,
  suggestPaintMix,
  type PaintColor,
} from "./paint-planning";

const projectId = "project-1" as PaintColor["projectId"];
const timestamp = "2026-01-01T00:00:00.000Z";

function paint(id: string, name: string, hex: string): PaintColor {
  return {
    id,
    schemaVersion: 1,
    projectId,
    manufacturer: "Műhely",
    name,
    pigmentCode: "",
    hex,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

describe("paint mixing suggestions", () => {
  it("uses an exact single paint when it matches the palette target", () => {
    const red = paint("red", "Vörös", "#FF0000");

    expect(suggestPaintMix("#ff0000", [red])).toEqual({
      targetHex: "#FF0000",
      components: [{ paint: red, fraction: 1 }],
      estimatedHex: "#FF0000",
      rgbDistance: 0,
    });
  });

  it("finds the closest linear RGB mixture and returns its component proportions", () => {
    const black = paint("black", "Fekete", "#000000");
    const white = paint("white", "Fehér", "#FFFFFF");
    const suggestion = suggestPaintMix("#808080", [white, black]);

    expect(suggestion).not.toBeNull();
    expect(suggestion?.components.map(({ paint: item }) => item.id)).toEqual(["white", "black"]);
    expect(suggestion?.components.map(({ fraction }) => fraction)).toEqual([128 / 255, 127 / 255]);
    expect(suggestion?.estimatedHex).toBe("#808080");
    expect(suggestion?.rgbDistance).toBe(0);
  });

  it("returns no suggestion for an empty inventory", () => {
    expect(suggestPaintMix("#123456", [])).toBeNull();
  });
});

describe("paint consumption estimates", () => {
  it("allocates area and total quantity, then aggregates shared recipe components", () => {
    const red = paint("red", "Vörös", "#FF0000");
    const black = paint("black", "Fekete", "#000000");
    const white = paint("white", "Fehér", "#FFFFFF");
    const redMix = suggestPaintMix("#FF0000", [red]);
    const grayMix = suggestPaintMix("#808080", [black, white]);
    if (!redMix || !grayMix) throw new Error("Expected paint suggestions for the fixture.");

    const estimate = calculatePaintConsumption(
      [
        { number: 1, hex: "#FF0000", pixelCount: 75 },
        { number: 2, hex: "#808080", pixelCount: 25 },
      ],
      100,
      [redMix, grayMix],
    );

    expect(estimate.paletteRows).toEqual([
      { number: 1, hex: "#FF0000", areaPercent: 75, quantity: 75 },
      { number: 2, hex: "#808080", areaPercent: 25, quantity: 25 },
    ]);
    expect(estimate.paintRows.map(({ paint: item, quantity }) => [item.id, quantity])).toEqual([
      ["red", 75],
      ["white", 25 * (128 / 255)],
      ["black", 25 * (127 / 255)],
    ]);
    expect(estimate.unmatchedPaletteNumbers).toEqual([]);
  });

  it("rejects missing palette data and non-positive or non-finite quantities", () => {
    expect(() => calculatePaintConsumption([], 10, [])).toThrow(/érvényes paletta/);
    expect(() => calculatePaintConsumption([{ number: 1, hex: "#000000", pixelCount: 1 }], 0, [])).toThrow(/nullánál nagyobb/);
    expect(() => calculatePaintConsumption([{ number: 1, hex: "#000000", pixelCount: 1 }], Number.POSITIVE_INFINITY, [])).toThrow(/véges/);
  });

  it("validates and normalizes persisted paint records", () => {
    const parsed = paintColorSchema.parse({
      ...paint("one", "Kék", "#abcdef"),
      manufacturer: "  Műhely  ",
      name: "  Kék  ",
    });
    expect(parsed.hex).toBe("#ABCDEF");
    expect(parsed.manufacturer).toBe("Műhely");
    expect(() => paintColorSchema.parse({ ...parsed, hex: "blue" })).toThrow();
  });
});
