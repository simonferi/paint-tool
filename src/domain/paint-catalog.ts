import { z } from "zod";

const catalogIdSchema = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,99}$/);
const nonEmptyTextSchema = z.string().trim().min(1);

const relativeCatalogPathSchema = z.string()
  .min(1)
  .refine((path) =>
    !path.startsWith("/")
      && !path.includes("\\")
      && path.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
  "Use a catalog-relative path without empty, '.' or '..' segments.");
const samplePathSchema = relativeCatalogPathSchema.refine(
  (path) => path.startsWith("samples/") && path.endsWith(".json"),
  "Sample records must be JSON files under samples/.",
);
const spectrumPathSchema = relativeCatalogPathSchema.refine(
  (path) => path.startsWith("spectra/") && path.endsWith(".csv"),
  "Spectra must be CSV files under spectra/.",
);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((date) => {
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}, "Use a valid calendar date.");

export const paintCatalogManifestSchema = z.object({
  schemaVersion: z.literal(1),
  catalogId: catalogIdSchema,
  title: nonEmptyTextSchema.max(200),
  source: z.object({
    title: nonEmptyTextSchema.max(300),
    url: z.string().url().optional(),
    doi: z.string().regex(/^10\.\d{4,9}\/\S+$/i).optional(),
    authors: z.array(nonEmptyTextSchema.max(200)),
    license: nonEmptyTextSchema.max(120),
    licenseUrl: z.string().url().optional(),
    attribution: nonEmptyTextSchema.max(500),
    retrievedOn: dateSchema.optional(),
  }).strict(),
  sampleFiles: z.array(samplePathSchema)
    .min(1)
    .superRefine((paths, context) => {
      if (new Set(paths).size !== paths.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: "Sample file paths must be unique." });
      }
    }),
}).strict();
export type PaintCatalogManifest = z.infer<typeof paintCatalogManifestSchema>;

const mixtureRecipeSchema = z.object({
  ratioBasis: z.enum(["mass", "volume", "parts", "not-reported"]),
  components: z.array(z.object({
    manufacturer: nonEmptyTextSchema.max(100),
    productName: nonEmptyTextSchema.max(100),
    productCode: z.string().trim().max(64).optional(),
    amount: z.number().finite().positive().nullable(),
  }).strict()).min(2),
}).strict();

export const paintCatalogSampleSchema = z.object({
  schemaVersion: z.literal(1),
  sampleId: catalogIdSchema,
  provenance: z.enum(["measured", "manufacturer", "derived", "estimated", "synthetic"]),
  product: z.object({
    id: catalogIdSchema,
    manufacturer: nonEmptyTextSchema.max(100),
    productLine: nonEmptyTextSchema.max(100).optional(),
    name: nonEmptyTextSchema.max(100),
    productCode: z.string().trim().max(64).optional(),
    pigmentCodes: z.array(z.string().trim().min(1).max(64)),
    displayHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    densityGPerMl: z.number().finite().positive().optional(),
  }).strict(),
  application: z.object({
    type: z.enum(["single-paint", "mixture"]),
    preparation: nonEmptyTextSchema.max(500),
    substrate: nonEmptyTextSchema.max(200),
    backing: nonEmptyTextSchema.max(200),
    dilution: nonEmptyTextSchema.max(200),
    varnish: z.enum(["unvarnished", "varnished", "unknown", "not-applicable"]),
    layerThicknessUm: z.number().finite().positive().optional(),
    notes: z.string().trim().max(1000).optional(),
  }).strict(),
  mixtureRecipe: mixtureRecipeSchema.optional(),
  measurement: z.object({
    method: z.enum(["spectrophotometer", "hyperspectral-imaging", "manufacturer-data", "synthetic", "other"]),
    instrument: nonEmptyTextSchema.max(200).optional(),
    geometry: nonEmptyTextSchema.max(200),
    specularCondition: z.enum(["included", "excluded", "unknown"]),
    wavelengthStartNm: z.number().finite().positive(),
    wavelengthEndNm: z.number().finite().positive(),
    sampleCount: z.number().int().min(2),
    wavelengthIntervalNm: z.number().finite().positive().optional(),
  }).strict().refine(
    ({ wavelengthStartNm, wavelengthEndNm }) => wavelengthStartNm < wavelengthEndNm,
    "The wavelength end must be greater than the wavelength start.",
  ),
  spectrumFile: spectrumPathSchema,
}).strict().superRefine((sample, context) => {
  if (sample.application.type === "mixture" && sample.mixtureRecipe === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mixtureRecipe"],
      message: "Mixture samples must include their original component recipe.",
    });
  }
  if (sample.application.type === "single-paint" && sample.mixtureRecipe !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["mixtureRecipe"],
      message: "Single-paint samples cannot include a mixture recipe.",
    });
  }
  if (sample.mixtureRecipe) {
    const amountsMustBeKnown = sample.mixtureRecipe.ratioBasis !== "not-reported";
    if (amountsMustBeKnown && sample.mixtureRecipe.components.some(({ amount }) => amount === null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mixtureRecipe", "components"],
        message: "Enter every component amount when the ratio basis is known.",
      });
    }
    const componentIds = sample.mixtureRecipe.components.map(({ manufacturer, productName, productCode }) =>
      `${manufacturer.toLocaleLowerCase()}|${productName.toLocaleLowerCase()}|${productCode ?? ""}`,
    );
    if (new Set(componentIds).size !== componentIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mixtureRecipe", "components"],
        message: "Mixture components must be unique.",
      });
    }
  }
});
export type PaintCatalogSample = z.infer<typeof paintCatalogSampleSchema>;

const paintSpectrumPointSchema = z.object({
  wavelengthNm: z.number().finite().positive(),
  reflectance: z.number().finite()
    .min(0, "Reflectance must be between 0 and 1.")
    .max(1, "Reflectance must be between 0 and 1."),
}).strict();

export const paintSpectrumSchema = z.array(paintSpectrumPointSchema)
  .min(2)
  .superRefine((points, context) => {
    for (let index = 1; index < points.length; index += 1) {
      if (points[index].wavelengthNm <= points[index - 1].wavelengthNm) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "wavelengthNm"],
          message: "Wavelengths must be strictly increasing and unique.",
        });
      }
    }
  });
export type PaintSpectrumPoint = z.infer<typeof paintSpectrumPointSchema>;

export type PaintCatalogFiles = {
  manifest: unknown;
  sampleFiles: Readonly<Record<string, unknown>>;
  spectraFiles: Readonly<Record<string, string>>;
};

export type PaintCatalog = {
  manifest: PaintCatalogManifest;
  samples: Array<{ metadata: PaintCatalogSample; spectrum: PaintSpectrumPoint[] }>;
};

function parseCsvNumber(value: string, rowNumber: number, columnName: string): number {
  const trimmed = value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
    throw new Error(`Spectrum CSV row ${rowNumber}: ${columnName} must be a number using a decimal point.`);
  }
  return Number(trimmed);
}

export function parsePaintSpectrumCsv(csv: string): PaintSpectrumPoint[] {
  const lines = csv.replace(/^\uFEFF/, "").split(/\r?\n/);
  const header = lines.shift()?.trim();
  if (header !== "wavelength_nm,reflectance") {
    throw new Error('Spectrum CSV must start with the header "wavelength_nm,reflectance".');
  }

  const points = lines.flatMap((line, index) => {
    if (!line.trim()) return [];
    const cells = line.split(",");
    if (cells.length !== 2) {
      throw new Error(`Spectrum CSV row ${index + 2}: expected exactly two comma-separated columns.`);
    }
    return [{
      wavelengthNm: parseCsvNumber(cells[0], index + 2, "wavelength_nm"),
      reflectance: parseCsvNumber(cells[1], index + 2, "reflectance"),
    }];
  });
  const result = paintSpectrumSchema.safeParse(points);
  if (!result.success) {
    throw new Error(`Invalid spectrum CSV: ${result.error.issues.map(({ message }) => message).join(" ")}`);
  }
  return result.data;
}

export function parsePaintCatalog(files: PaintCatalogFiles): PaintCatalog {
  const manifest = paintCatalogManifestSchema.parse(files.manifest);
  if (Object.keys(files.sampleFiles).length !== manifest.sampleFiles.length) {
    throw new Error("The number of sample files must match the manifest sampleFiles list.");
  }

  const samples = manifest.sampleFiles.map((samplePath) => {
    const sampleRecord = files.sampleFiles[samplePath];
    if (sampleRecord === undefined) {
      throw new Error(`Manifest references missing sample file: ${samplePath}`);
    }
    const metadata = paintCatalogSampleSchema.parse(sampleRecord);
    const csv = files.spectraFiles[metadata.spectrumFile];
    if (csv === undefined) {
      throw new Error(`Sample ${metadata.sampleId} references missing spectrum file: ${metadata.spectrumFile}`);
    }
    const spectrum = parsePaintSpectrumCsv(csv);
    const first = spectrum[0];
    const last = spectrum[spectrum.length - 1];
    if (spectrum.length !== metadata.measurement.sampleCount) {
      throw new Error(
        `Sample ${metadata.sampleId} declares ${metadata.measurement.sampleCount} spectral samples but contains ${spectrum.length}.`,
      );
    }
    if (
      Math.abs(first.wavelengthNm - metadata.measurement.wavelengthStartNm) > 1e-6
      || Math.abs(last.wavelengthNm - metadata.measurement.wavelengthEndNm) > 1e-6
    ) {
      throw new Error(`Sample ${metadata.sampleId} wavelength endpoints do not match its measurement metadata.`);
    }
    if (metadata.measurement.wavelengthIntervalNm !== undefined) {
      const { wavelengthIntervalNm } = metadata.measurement;
      const hasUnexpectedInterval = spectrum.slice(1).some((point, index) =>
        Math.abs(point.wavelengthNm - spectrum[index].wavelengthNm - wavelengthIntervalNm) > 1e-6,
      );
      if (hasUnexpectedInterval) {
        throw new Error(`Sample ${metadata.sampleId} wavelength intervals do not match its measurement metadata.`);
      }
    }
    return { metadata, spectrum };
  });

  const sampleIds = samples.map(({ metadata }) => metadata.sampleId);
  const spectrumPaths = samples.map(({ metadata }) => metadata.spectrumFile);
  if (new Set(sampleIds).size !== sampleIds.length) {
    throw new Error("Sample IDs must be unique within a catalog.");
  }
  if (new Set(spectrumPaths).size !== spectrumPaths.length) {
    throw new Error("Each sample must have its own spectrum file.");
  }
  if (Object.keys(files.spectraFiles).length !== spectrumPaths.length) {
    throw new Error("The number of spectrum files must match the sample file references.");
  }

  return { manifest, samples };
}
