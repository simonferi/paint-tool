import { describe, expect, it } from "vitest";
import {
  paintCatalogManifestSchema,
  paintCatalogSampleSchema,
  parsePaintCatalog,
  parsePaintSpectrumCsv,
} from "./paint-catalog";

const catalogFiles = import.meta.glob<string>("../../data/paint-catalogs/**/*.{json,csv}", {
  eager: true,
  query: "?raw",
  import: "default",
});
const catalogRoot = "../../data/paint-catalogs/";

function readCatalogFiles(manifestPath: string) {
  const manifestText = catalogFiles[manifestPath];
  if (!manifestText) throw new Error(`Missing catalog manifest: ${manifestPath}`);
  const manifestInput: unknown = JSON.parse(manifestText);
  const manifest = paintCatalogManifestSchema.parse(manifestInput);
  const catalogDirectory = manifestPath.slice(catalogRoot.length).replace(/manifest\.json$/, "");
  const sampleFiles: Record<string, unknown> = {};
  const spectraFiles: Record<string, string> = {};

  for (const samplePath of manifest.sampleFiles) {
    const sampleText = catalogFiles[`${catalogRoot}${catalogDirectory}${samplePath}`];
    if (!sampleText) throw new Error(`Missing catalog sample: ${samplePath}`);
    const sampleInput: unknown = JSON.parse(sampleText);
    sampleFiles[samplePath] = sampleInput;
    const sample = paintCatalogSampleSchema.parse(sampleInput);
    const spectrumText = catalogFiles[`${catalogRoot}${catalogDirectory}${sample.spectrumFile}`];
    if (spectrumText === undefined) throw new Error(`Missing spectrum file: ${sample.spectrumFile}`);
    spectraFiles[sample.spectrumFile] = spectrumText;
  }

  return { manifest: manifestInput, sampleFiles, spectraFiles };
}

describe("paint catalog files", () => {
  it("validates every catalog's manifest, samples, and raw spectra", () => {
    const manifestPaths = Object.keys(catalogFiles).filter((path) => path.endsWith("/manifest.json"));
    expect(manifestPaths.length).toBeGreaterThan(0);

    for (const manifestPath of manifestPaths) {
      const files = readCatalogFiles(manifestPath);
      const catalog = parsePaintCatalog(files);
      expect(catalog.manifest.catalogId).toBeTruthy();
      expect(catalog.samples.length).toBeGreaterThan(0);

      const catalogDirectory = manifestPath.replace(/manifest\.json$/, "");
      const expectedFiles = [
        manifestPath,
        ...catalog.manifest.sampleFiles.map((path) => `${catalogDirectory}${path}`),
        ...catalog.samples.map(({ metadata }) => `${catalogDirectory}${metadata.spectrumFile}`),
      ].sort();
      const actualFiles = Object.keys(catalogFiles)
        .filter((path) => path.startsWith(catalogDirectory))
        .sort();
      expect(actualFiles).toEqual(expectedFiles);
    }
  });

  it("retains a source spectrum on its original wavelength grid", () => {
    const manifestPath = `${catalogRoot}examples/synthetic-demo/manifest.json`;
    const catalog = parsePaintCatalog(readCatalogFiles(manifestPath));

    expect(catalog.samples[0].spectrum).toEqual([
      { wavelengthNm: 400, reflectance: 0.18 },
      { wavelengthNm: 410, reflectance: 0.24 },
      { wavelengthNm: 420, reflectance: 0.31 },
    ]);
  });

  it("rejects malformed, unordered, or out-of-range reflectance rows", () => {
    expect(() => parsePaintSpectrumCsv("wavelength_nm,reflectance\n410,0.4\n400,0.3"))
      .toThrow(/strictly increasing/);
    expect(() => parsePaintSpectrumCsv("wavelength_nm,reflectance\n400,1.1"))
      .toThrow(/0 and 1/);
    expect(() => parsePaintSpectrumCsv("wavelength_nm,reflectance\n400,not-a-number"))
      .toThrow(/must be a number/);
    expect(() => parsePaintSpectrumCsv("wavelength_nm,reflectance\n400,0.4,extra"))
      .toThrow(/exactly two/);
  });

  it("rejects sample metadata that disagrees with the spectrum file", () => {
    const manifestPath = `${catalogRoot}examples/synthetic-demo/manifest.json`;
    const files = readCatalogFiles(manifestPath);
    const samplePath = "samples/example-paint.json";
    const sample = paintCatalogSampleSchema.parse(files.sampleFiles[samplePath]);
    files.sampleFiles[samplePath] = {
      ...sample,
      measurement: { ...sample.measurement, sampleCount: 4 },
    };

    expect(() => parsePaintCatalog(files)).toThrow(/declares 4 spectral samples but contains 3/);
  });

  it("rejects unsafe catalog paths and unknown manifest keys", () => {
    const files = readCatalogFiles(`${catalogRoot}examples/synthetic-demo/manifest.json`);
    const manifest = paintCatalogManifestSchema.parse(files.manifest);

    expect(() => paintCatalogManifestSchema.parse({
      ...manifest,
      sampleFiles: ["../outside.json"],
    })).toThrow();
    expect(() => paintCatalogManifestSchema.parse({
      ...manifest,
      licence: "typo",
    })).toThrow(/Unrecognized key/);
  });

  it("requires auditable ingredient amounts for mixture samples", () => {
    const sample = paintCatalogSampleSchema.parse(
      readCatalogFiles(`${catalogRoot}examples/synthetic-demo/manifest.json`)
        .sampleFiles["samples/example-paint.json"],
    );
    expect(() => paintCatalogSampleSchema.parse({
      ...sample,
      application: { ...sample.application, type: "mixture" },
    })).toThrow(/must include their original component recipe/);
  });
});
