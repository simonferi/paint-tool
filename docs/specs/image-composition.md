# Specification: Images, Composition, and Grids

## Goal

Let artists compare the composition of a reference, an in-progress image, and a planned canvas using consistent, easy-to-understand guides.

## Inputs

- A reference image and an optional image of the work in progress.
- The TypeScript application shows an immediate preview and aspect ratio in the upload area. The image remains available after project changes and reloads until it is replaced.
- The thumbnail shows the complete image, preserves its original aspect ratio, and fits the available space without cropping its edges.
- Aspect ratio: unconstrained view, a preset ratio, or a custom ratio based on user-entered dimensions in centimeters.
- Planned width and height in centimeters.
- Grid type and its parameters.

## Aspect-ratio frame

- Center the frame to indicate a crop without cropping or rewriting the uploaded image.
- The area outside the frame may be faded; the frame boundary must remain visible.
- For a custom frame, the ratio is `width_cm / height_cm`.
- If either dimension is missing or non-positive, the custom frame is unavailable and an explanatory message is shown.

## Grid types

- Rule of thirds: 3 columns × 3 rows.
- Preset dense grids: 4 × 4, 6 × 6, 8 × 8, and 10 × 10.
- Custom layout: user-entered integer column and row counts.
- Centimeter grid: a shared grid spacing of `s` cm.
- Diagonal and center-line guides.
- No-grid view.

## Dimension calculations

Let `W` and `H` be the planned canvas width and height in centimeters.

- For a custom layout with `C` columns and `R` rows:
  - column spacing, the horizontal distance between vertical grid lines: `W / C` cm;
  - row spacing, the vertical distance between horizontal grid lines: `H / R` cm.
- For a square grid with spacing `s` cm, interior vertical lines are at `s, 2s, 3s, ... < W`; horizontal lines are at `s, 2s, 3s, ... < H`.
- If `W` or `H` is not divisible by `s`, the edge cell is shorter; the interface must indicate this.
- Example: `30 × 24 cm` with `10 × 6` divisions gives `3 cm` column spacing and `4 cm` row spacing.
- Example: `30 × 40 cm` with `3 × 3` divisions gives `10 cm` column spacing and `13.33 cm` row spacing.
- The MVP draws at most 100 interior lines per direction. A future product should define performance limits for its target platform.

## Rendering and state updates

- Reference and in-progress previews use the same selected aspect ratio and grid settings.
- The combined palette map and all per-color maps use the same selected grid and aspect-ratio frame.
- Changes to grid settings update previews and available map exports.
- A grid is a visual overlay and does not modify the source image.
- Status text shows the selected column/row counts or calculated spacing in centimeters. Invalid dimensions or overly dense settings must not produce a misleading grid.
- Aspect ratio, dimensions, and grid settings are automatically saved as project metadata and restored after a project switch or reload.

## Acceptance examples

1. `30 × 24 cm`, 10 columns and 6 rows: show `3 cm` and `4 cm` spacing.
2. `30 × 24 cm` with a 4 cm square grid: show 7 interior vertical and 5 interior horizontal lines; edge cells may differ in size.
3. A 10 × 10 grid appears on every image preview and palette map and is included in exported PNG files.
4. Empty dimensions or invalid division counts produce an explanatory status.
