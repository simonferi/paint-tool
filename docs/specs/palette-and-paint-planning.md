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

The MVP does not store the remaining quantity of a paint in grams or milliliters.

### Mixing plan

- Find the closest approximation for each palette color using one or two paints from the inventory.
- Current implementation: compare colors in RGB space and use linear interpolation between two colors.
- Show the paint name, the proportions for a two-paint mix, the estimated screen color, and the RGB difference.
- Treat the plan as a practical test-mix suggestion. It does not model pigment light absorption, opacity, transparency, brand differences, support, or lighting.

The TypeScript MVP uses the extracted palette HEX values as targets. It compares single-paint matches, then calculates the nearest linear mix ratio to the target along each pair of paint colors in RGB space. The displayed RGB difference is Euclidean distance across 8-bit channels. The paint inventory and per-color saved notes are stored locally in IndexedDB by project. Mixing and consumption results can be recalculated and must not be presented as saved physical recipes.

- Automatically persist the palette source image, requested color count, contour setting, total planned paint quantity, and unit as project metadata.
- Preserve the unfinished paint form and the paint identifier currently being edited so data entry can continue after a project switch or reload.
- Automatically save mixing notes while typing; the explicit save button remains available for immediate saving.

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

## Aggregating quantities by paint

Let the estimated quantity for palette color `i` be `T_i`. If the suggested recipe uses paints `a` and `b` in ratio `r_a : r_b`:

- quantity of paint `a`: `T_i × r_a / (r_a + r_b)`;
- quantity of paint `b`: `T_i × r_b / (r_a + r_b)`.

For a single-paint recipe, assign the full `T_i` quantity to that paint. Sum quantities by paint identifier.

The second table shows each paint used, its manufacturer/color name, pigment/product code, total estimated quantity, and percentage of total `T`. Sort rows by descending total quantity.

## Input errors and limitations

- Total paint quantity must be finite and greater than zero.
- If no palette map is available, both tables should indicate that a palette must be generated.
- If there is no paint inventory, the first table may still show area ratios and total per-color quantities; the second should ask the user to add paints.
- Rounding displayed values may make row totals differ slightly from the entered total.
- The estimate does not include priming, underpainting, paint left on brushes, waste, layer thickness, or surface absorbency.

## Acceptance examples

1. For a total of 100 g, a color covering 75% of the image receives 75 g and one covering 25% receives 25 g.
2. If a 25 g palette color uses two paints in a 1:1 ratio, each paint receives 12.5 g.
3. If a paint is used in another palette color's single-paint recipe, add both quantities together.
4. Sort the paint table by descending total estimated quantity.
5. When changing units, display the new `g`/`ml` label in quantities and status messages; the proportional allocation remains unchanged.
