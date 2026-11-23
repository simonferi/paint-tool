# Local paint catalog files

This directory stores versioned, editable paint-product measurements. The application does not upload these files; files committed here are distributed with the repository.

## Layout

Keep each catalog tied to one published dataset or one independently measured collection:

```text
data/paint-catalogs/
  <catalog-id>/
    manifest.json
    samples/
      <sample-id>.json
    spectra/
      <sample-id>.csv
```

- `manifest.json` records the dataset citation, source URL or DOI, license, attribution, and the sample files in the catalog.
- Each sample JSON records the exact product identity, sample preparation, substrate/backing, coating state, measurement method, wavelength grid, provenance, and its spectrum file.
- For a mixture sample, include the original component amounts and identify whether they are by mass, by volume, or source-reported parts. If the source does not report a recipe, use `not-reported` and `null` amounts rather than inventing ratios.
- Each spectrum CSV contains the source reflectance curve, with one wavelength per row. Keep the source grid and values unchanged; create a separately identified derived sample when resampling or otherwise transforming data.
- Multiple samples may refer to the same paint product, for example undiluted, diluted, or varnished drawdowns. Use distinct `sampleId` values and describe those conditions instead of overwriting one curve.

The CSV is UTF-8, uses a decimal point and the exact header `wavelength_nm,reflectance`. Wavelengths are in nanometers, reflectance is a fraction from 0 to 1, and rows must be sorted by strictly increasing wavelength. Empty lines are ignored; quoted values and extra columns are not part of this format.

Use `measured`, `manufacturer`, `derived`, `estimated`, or `synthetic` for provenance. `derived`, `estimated`, and `synthetic` data must not be presented as manufacturer measurements. Enter `unknown` for unavailable measurement conditions instead of guessing them. Always record the dataset license before adding third-party data.

## Validation

Run:

```powershell
npm run validate:paint-catalogs
```

The command validates every catalog file against the Zod schemas in `src/domain/paint-catalog.ts`, including file references, unique sample IDs, reflectance ranges, sorted wavelength values, and consistency between the sample metadata and CSV grid.

The current Kubelka–Munk UI still accepts only 41 positive reflectance values at 380–780 nm in 10 nm steps and assumes an optically infinite diffuse layer. Catalogs intentionally preserve the original measurement grid and conditions; conversion into the app's input format must be explicit, separately documented, and must not hide missing wavelengths or incompatible sample conditions.

## Example and sourced data

`examples/synthetic-demo/` is only a format fixture. Its values are invented and must never be treated as measured paint data or used for paint recommendations.

No third-party spectrum dataset is bundled here yet. For example, the Old Holland HSI dataset at <https://zenodo.org/records/13359559> declares **CC BY-NC-ND 4.0**. Do not copy, resample, or redistribute its measurements in this repository without confirming that the license permits the intended use or obtaining permission.
