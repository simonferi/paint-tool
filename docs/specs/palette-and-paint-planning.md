# Specification: Palette, Oil Paints, and Consumption

## Limited palette

- Users can create a limited palette from the reference image or the in-progress image.
- The MVP offers palettes of 4, 5, 6, 8, or 10 colors. The algorithm may produce fewer colors if the image does not contain enough distinct colors.
- Each palette color has a number, swatch, HEX value, and pixel count.
- Color grouping must produce discrete, clearly identifiable regions on the map.
- In the MVP, the number and HEX value identify each color. User-defined aliases may be added in the future.

## Paint inventory and mixing plan

### Paint details

Each paint entry can include:

- manufacturer;
- color name;
- pigment or product code;
- HEX swatch.
- optional diffuse-reflectance samples on the 380–780 nm, 10 nm grid, with provenance, source, and an explicit optically-infinite-layer confirmation;
- optional product density in g/ml for converting physical mass ratios to volume estimates.

The MVP does not store the remaining quantity of a paint in grams or milliliters.

### Mixing plan

- Find the closest approximation for each palette color using one or two paints from the inventory.
- The default and explicit fallback compares HEX colors in RGB space and uses linear interpolation between two colors.
- An optional Kubelka–Munk mode considers only paint records with validated, sourced spectral reflectance. It applies the single-constant infinite-layer `F(R∞)=K/S` model, mixes `K/S` by paint mass fraction under a shared-scattering assumption, and compares the predicted color with the target using CIEDE2000 under CIE D65 / CIE 1931 2°.
- Show the paint name, proportions, estimated screen color, comparison metric, and (for the physical mode) optical-data provenance.
- Keep both results as estimates. The RGB mode is a display-color approximation; the initial Kubelka–Munk mode is not a validated general paint simulator.

The TypeScript implementation uses extracted palette HEX values as targets. The RGB fallback compares single-paint matches and searches linear mixes along each pair of paint colors. The Kubelka–Munk mode compares single paints and searches two-paint mass ratios using the entered spectra. RGB distance and CIEDE2000 are distinct metrics and are labeled accordingly. The paint inventory and per-color saved notes are stored locally in IndexedDB by project. Mixing and consumption results can be recalculated and must not be presented as saved physical recipes.

### Project preferences and persistence

- Automatically persist the palette source image, requested color count, contour setting, total planned paint quantity, and unit as project metadata.
- Preserve the unfinished paint form and the paint identifier currently being edited so data entry can continue after a project switch or reload.
- Automatically save mixing notes while typing; the explicit save button remains available for immediate saving.

## Initial Kubelka–Munk implementation and future extensions

The initial model is separately versioned from the RGB fallback. Existing HEX-only records migrate without fabricated spectra and remain usable in RGB mode.

### Optical model and assumptions

Kubelka–Munk (KM) is a two-flux model for absorption and scattering in a diffuse, homogeneous coating. For an optically infinite layer, the single-constant approximation treats scattering as constant and relates diffuse reflectance `R∞` to the absorption-to-scattering ratio:

`F(R∞) = (1 - R∞)² / (2R∞) = K / S`

In the more general form, model absorption `K(λ)` and scattering `S(λ)` at each wavelength `λ`. For a mixture whose data supports concentration-linear coefficients, with normalized paint-product mass fractions `w_i`:

```text
K_mix(λ) = Σ w_i K_i(λ)
S_mix(λ) = Σ w_i S_i(λ)
```

Predict the mixture's spectral reflectance from the resulting coefficients using the selected KM layer model. `F(R)` alone provides a `K/S` ratio under the stated assumptions; it does not recover independent `K` and `S` spectra. A single measured reflectance curve is therefore insufficient for a general finite-layer prediction.

The initial implementation accepts a 41-sample reflectance curve for a declared diffuse, optically infinite layer and assumes shared, constant scattering. It does not recover independent `K` and `S` spectra. Finite paint layers require a defined thickness and substrate reflectance and are not implemented; do not silently use the infinite-layer equation for translucent or thin applications.

### Paint optical data

- The physical model must use data for the exact paint product/formulation where possible. A pigment code, brand name, or display HEX alone is not a product-specific optical dataset.
- Prefer product-specific spectral reflectance and/or `K(λ)` and `S(λ)` data over a documented visible-wavelength grid. The initial proposed grid is 380–780 nm in 10 nm steps; any other grid must be documented and consistently resampled.
- The initial UI accepts exactly 41 reflectance samples from 380 nm through 780 nm in 10 nm steps, each greater than zero and at most one. A source and the infinite-layer condition must be provided before these data can be used.
- Store the data source, product identifier, dataset/model version, measurement or derivation method, and whether values are measured, inferred, or synthetic.
- Where data comes from a measured film, record the wavelength grid, measurement geometry, specular-included/excluded condition, substrate/backing, layer thickness, and paint formulation/loading when available. Data must identify the conditions under which its coefficients can be mixed.
- The initial record stores provenance, source, wavelength grid, and the declared diffuse/infinite-layer condition. Detailed geometry, backing, thickness, formulation, and loading metadata remain future work.
- Product-level coefficients must account for the paint formulation and its pigment concentration. Do not assume that pure-pigment properties directly describe a commercial paint tube.
- Existing HEX-only paints remain usable with the RGB fallback. Do not invent `K/S` values or upgrade their confidence during migration.
- Use only data and datasets whose licensing permits distribution and the application's intended use.
- Keep user paint data and source images local. Any remote catalogue or synchronization feature requires a separate privacy review and product requirement.

### Ratios, prediction, and color comparison

- Physical mixing ratios are fractions by mass of the entered paint products. If users enter volume ratios, convert using the density of each exact product. If a density is unavailable, do not report the volume ratio as a physically modeled mass ratio.
- For a recipe with one or two paints, predict reflectance across the full wavelength grid; do not mix the input HEX channels to produce the physical result.
- Convert predicted reflectance to a displayed color using CIE D65 and the CIE 1931 2° standard observer.
- Compare predicted and target colors in a perceptual space using CIEDE2000 (`ΔE00`). Label the metric and colorimetric settings with the result.
- A reference-image target is still an sRGB sample from a camera/display pipeline, not a measured reflectance spectrum. Show this limitation and do not imply that the target or preview is colorimetrically calibrated.
- Show the predicted swatch, recipe, mass proportions, color difference, model/data provenance, and a clear approximation notice. A spectral curve may be exposed for inspection.
- Keep the model's color prediction separate from coverage/consumption estimates. KM does not predict layer thickness, brush loss, surface area, or required grams/milliliters.

### Fallback behavior and limitations

- When product optical data is missing or incompatible, explain what is missing and either withhold the physical estimate or explicitly switch to the labeled RGB fallback.
- Never label a synthetic spectrum reconstructed from RGB as measured product data.
- Treat KM output as an estimate. Assumptions such as diffuse scattering, homogeneous films, coefficient additivity, substrate, and layer thickness limit its accuracy.
- The initial model does not claim to model gloss, surface texture, uneven application, drying/aging, binder interactions, or transparent glazes unless those effects are represented by validated inputs and a model extension.
- Version optical datasets, assumptions, and algorithms. Invalidate cached predictions when any of them changes.

### Validation and acceptance

1. With measured optical data for a yellow and a blue paint, a recipe should be capable of predicting a green-like result; it must not be constrained to linear RGB interpolation.
2. The same paint data, mass ratios, model version, and colorimetric settings produce deterministic results.
3. Current unit tests cover the transform, deterministic mixing, colorimetry, and error metric. The model has not yet been validated against a documented measured reference set; define acceptable tolerances from such a set before describing it as validated.
4. A missing density blocks a volume-to-mass physical conversion and returns an explanatory state.
5. A HEX-only paint never produces a result labeled as a measured or product-specific KM prediction.
6. Changing the configured illuminant/observer updates the displayed color comparison without changing the underlying predicted reflectance spectrum.

### Inspiration and implementation constraints

- [Spectral.js 3.0.0](https://github.com/rvanwijnen/spectral.js/tree/3.0.0) demonstrates a browser-oriented spectral/Kubelka–Munk mixing workflow and colorimetric display. Its README describes reconstructing spectra from RGB using a set of basis curves and a single-constant KM model; such reconstructed data must be marked inferred/synthetic, not measured product data. Review the [version's MIT license](https://github.com/rvanwijnen/spectral.js/blob/3.0.0/LICENSE) before considering it as a dependency.
- [Mixbox](https://github.com/scrtwpns/mixbox) is an inspiration for pigment-like hue shifts and an approachable mixing interaction. Its repository states that it uses Kubelka–Munk theory; its [license](https://github.com/scrtwpns/mixbox/blob/master/LICENSE) identifies the distribution as CC BY-NC 4.0. Do not copy or bundle its implementation, lookup tables, assets, or datasets into this MIT-licensed project without separately confirming permission and licensing.
- These are reference implementations, not a requirement to add either package as a dependency. Independently specify and validate the model, and review the selected version's license before adopting any third-party code or data.
- See also [Kubelka's treatment of coating reflectance](https://www.graphics.cornell.edu/~westin/pubs/kubelka.pdf) and the [Mixbox paper](https://scrtwpns.com/mixbox.pdf).

### Consumption estimates with physical recipes

- Keep recipe fractions and output units explicit. For a physical recipe, compute component masses from the mass fractions.
- For per-paint output in milliliters, convert each component mass using that exact paint product's density and an explicit additive-volume assumption. If the densities needed for conversion are missing, withhold the physical volume breakdown and explain why; never assume `1 g = 1 ml`.
- Do not imply that Kubelka–Munk predicts total coverage, layer thickness, or the total quantity needed. Existing coverage estimates remain separate approximations.

## Area ratios and total paint quantity

Let:

- `N` be the total number of pixels in the map;
- `n_i` be the number of pixels assigned to palette color `i`;
- `p_i = n_i / N` be the image-area ratio of color `i`;
- `T` be the total paint quantity entered by the user;
- `u` be the selected unit (`g` or `ml`).

The first table shows for each palette color:

- its number and HEX identifier;
- area percentage: `100 × p_i`;
- estimated palette-mix quantity: `T_i = T × p_i`, in unit `u`.

Sort rows by descending `p_i`. Keep original palette-number order stable for ties.

For KM-backed recipes, the palette-area calculation remains a user-supplied coverage estimate; the KM model does not infer `T` or the required layer thickness. Component allocation must respect the recipe's mass fractions. For per-color output in milliliters, use product-specific densities and an explicit additive-volume assumption to convert the component masses; if those inputs are unavailable, withhold the physical volume breakdown rather than assume `1 g = 1 ml`.

## Aggregating quantities by paint

Let the estimated quantity for palette color `i` be `T_i`. If the suggested recipe uses paints `a` and `b` in ratio `r_a : r_b`:

- quantity of paint `a`: `T_i × r_a / (r_a + r_b)`;
- quantity of paint `b`: `T_i × r_b / (r_a + r_b)`.

For a KM-backed recipe, `r_a` and `r_b` are mass proportions. Apply the equations directly when `T_i` is a mass. If `T_i` is a volume, derive component masses/volumes only with product-specific densities and the documented volume-additivity assumption.

For a single-paint recipe, assign the full `T_i` quantity to that paint. Sum quantities by paint identifier.

The second table shows each paint used, its manufacturer/color name, pigment/product code, total estimated quantity, and percentage of total `T`. Sort rows by descending total quantity.

## Input errors and limitations

- Total paint quantity must be finite and greater than zero.
- If no palette map is available, both tables should indicate that a palette must be generated.
- If there is no paint inventory, the first table may still show area ratios and total per-color quantities; the second should ask the user to add paints.
- Rounding displayed values may make row totals differ slightly from the entered total.
- The estimate does not include priming, underpainting, paint left on brushes, waste, layer thickness, or surface absorbency.
- The KM color prediction, when available, does not remove these consumption-estimation limitations.

## Acceptance examples

1. For a total of 100 g, a color covering 75% of the image receives 75 g and one covering 25% receives 25 g.
2. If a 25 g palette color uses two paints in a 1:1 ratio, each paint receives 12.5 g.
3. If a paint is used in another palette color's single-paint recipe, add both quantities together.
4. Sort the paint table by descending total estimated quantity.
5. When changing units, display the new `g`/`ml` label in quantities and status messages; the proportional allocation remains unchanged.
6. Keep current RGB-mix results identifiable as RGB estimates. A future KM result must expose the optical-data source, model assumptions/version, mass ratio, illuminant/observer, and perceptual comparison metric.
