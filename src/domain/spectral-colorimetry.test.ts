import { describe, expect, it } from "vitest";
import {
  deltaE2000,
  hexFromReflectance,
  kubelkaMunkFunction,
  labFromReflectance,
  mixInfiniteLayerReflectance,
} from "./spectral-colorimetry";

describe("Kubelka–Munk and spectral colorimetry", () => {
  it("uses the single-constant K/S transform and preserves a single-paint spectrum", () => {
    const reflectance = Array<number>(41).fill(0.5);
    const mixed = mixInfiniteLayerReflectance([{ reflectance, massFraction: 1 }]);

    expect(kubelkaMunkFunction(0.5)).toBeCloseTo(0.25, 12);
    mixed.forEach((value, index) => expect(value).toBeCloseTo(reflectance[index], 12));
  });

  it("mixes K/S by mass fraction instead of averaging reflectance", () => {
    const first = Array<number>(41).fill(0.2);
    const second = Array<number>(41).fill(0.8);
    const mixed = mixInfiniteLayerReflectance([
      { reflectance: first, massFraction: 1 },
      { reflectance: second, massFraction: 1 },
    ]);
    const mixedKs = (kubelkaMunkFunction(0.2) + kubelkaMunkFunction(0.8)) / 2;
    const expected = 1 / (1 + mixedKs + Math.sqrt(mixedKs * (mixedKs + 2)));

    expect(mixed[20]).toBeCloseTo(expected, 12);
    expect(mixed[20]).not.toBeCloseTo(0.5, 2);
  });

  it("normalizes supplied mass fractions and rejects invalid spectral samples", () => {
    const first = Array<number>(41).fill(0.3);
    const second = Array<number>(41).fill(0.7);
    const equalMix = mixInfiniteLayerReflectance([
      { reflectance: first, massFraction: 0.5 },
      { reflectance: second, massFraction: 0.5 },
    ]);
    const proportionallyEqualMix = mixInfiniteLayerReflectance([
      { reflectance: first, massFraction: 2 },
      { reflectance: second, massFraction: 2 },
    ]);

    expect(equalMix).toEqual(proportionallyEqualMix);
    expect(() => mixInfiniteLayerReflectance([
      { reflectance: [...first.slice(1), 0], massFraction: 1 },
    ])).toThrow();
    expect(() => mixInfiniteLayerReflectance([
      { reflectance: Array<number>(41).fill(0), massFraction: 1 },
    ])).toThrow();
    expect(() => mixInfiniteLayerReflectance([
      { reflectance: first, massFraction: 0 },
    ])).toThrow(/pozitív/);
  });

  it("integrates a perfect diffuser as D65 white", () => {
    const white = Array<number>(41).fill(1);

    expect(labFromReflectance(white)).toEqual([100, 0, 0]);
    expect(hexFromReflectance(white)).toBe("#FFFFFF");
  });

  it("matches the published CIEDE2000 reference pair", () => {
    expect(deltaE2000(
      [50, 2.6772, -79.7751],
      [50, 0, -82.7485],
    )).toBeCloseTo(2.0425, 4);
  });
});
