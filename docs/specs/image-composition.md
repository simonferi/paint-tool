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

## Crop and canvas-size frame

The frame uses the planned canvas ratio `W / H`, where `W` and `H` are the planned width and height in centimeters. The ratio is locked during interaction; changing its size scales both dimensions proportionally. The planned centimeter dimensions determine the ratio, not the output pixel resolution.

### Crop

- Keep the frame entirely within the source image. Its contents are the selected reference region.
- Allow the user to resize the frame proportionally and move it horizontally or vertically relative to the reference.
- Clamp the frame at the image edges. Its largest size is the largest rectangle with the target ratio that fits inside the source image; its smallest size must retain a useful output resolution.
- Apply the selected crop as a non-destructive transform to the composition preview, tone analysis, palette extraction, and map/export source. Preserve the uploaded source file unchanged.
- Include crop geometry and source-asset revision in analysis and palette cache identity. Changing the crop invalidates derived results for the previous frame.

### Change canvas size

- Keep every source-image pixel inside the target-ratio frame. The frame represents a larger canvas around the reference image, not a crop.
- Allow proportional enlargement or reduction down to the smallest frame that contains the full source image, and movement while constraining it so no part of the original image is clipped.
- Display the area inside the frame but outside the source image as blank/unpainted canvas. Do not generate or infer image content there.
- Tone and palette analysis use the source-image pixels only. Normalize palette percentages over those assigned image pixels and report canvas coverage separately; do not treat blank extension as a palette color. Maps may render the blank area, but it remains unassigned.
- The default blank-canvas fill/appearance and whether it is configurable or exported remain an open product decision.

### Interaction, display, and persistence

- Provide a visible draggable frame with proportional corner handles, plus accessible sliders and numeric fields for scale and horizontal/vertical position. Support pointer, touch, and keyboard input.
- Show the area outside the frame with a darkened or faded overlay while keeping the active frame legible. In Change canvas size mode, distinguish blank extension inside the frame from the dimmed outside area.
- Provide a mode-default reset: the largest target-ratio crop that fits for Crop, or the smallest frame that contains the full source image for Change canvas size. Also allow restoring the unmodified full-image state.
- Provide an unmodified full-image state. Until the user selects Crop or Change canvas size, keep the full source image as the downstream input; allow the user to return to this state without deleting the source.
- Store the mode, scale, and position in project metadata associated with the selected reference asset. Use normalized image-relative coordinates so the selection is independent of preview size.
- If planned dimensions change the target ratio, preserve the frame center and scale as far as possible, recalculate its locked-ratio geometry, and clamp it to valid bounds for the current mode. Show feedback if clamping changes the requested size or position.
- When a reference image is replaced, do not apply the old asset's saved coordinates to the new image; initialize a new default frame and explain that it can be adjusted.
- If planned dimensions are missing or non-positive, disable ratio-locked framing and show an explanatory message. Do not fall back silently to a different ratio.

## Crop and canvas-size frame

- The composition settings persist a frame operation: `crop` keeps the frame inside the reference image, while `canvas` allows the frame to grow beyond the reference to represent added canvas area.
- The frame can be moved horizontally and vertically relative to the reference, and its size changes proportionally.
- The reference preview provides direct pointer dragging and proportional corner handles. Sliders expose the same size and position controls for keyboard and precise input.
- Regions outside the frame are visibly dimmed. The source image remains unchanged; the frame is a planning overlay only.
- The same persisted frame is used by the in-progress preview and palette-map guides.

## Generated image output

- Numbered palette maps and per-color maps use the persisted active frame as their output canvas, not merely as a visual overlay.
- Crop mode exports only the selected source region. Canvas mode exports the enlarged frame and fills newly added canvas area with white.
- Changing the active frame regenerates the currently available palette-map previews and, when a project folder is connected, overwrites the corresponding generated PNG files.
- Palette extraction and color-area counts use the active frame as their input region. A palette calculated for a different active frame is not reused; it must be generated again.

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
- The selected Crop or Change canvas size frame is visible in the reference preview and drives the corresponding derived composition.
- The combined palette map and all per-color maps use the same selected grid and aspect-ratio frame.
- Changes to framing or grid settings update previews, analysis that depends on the reference region, palette maps, and available exports.
- Do not reuse analyses or palette results created from the full image or a different crop frame.
- Grids and framing are non-destructive transforms/overlays and do not modify the source image.
- Status text shows the selected column/row counts or calculated spacing in centimeters. Invalid dimensions or overly dense settings must not produce a misleading grid.
- Aspect ratio, dimensions, and grid settings are automatically saved as project metadata and restored after a project switch or reload.
- Framing changes must not invalidate or rewrite the stored original image or its source dimensions.

## Acceptance examples

1. `30 × 24 cm`, 10 columns and 6 rows: show `3 cm` and `4 cm` spacing.
2. `30 × 24 cm` with a 4 cm square grid: show 7 interior vertical and 5 interior horizontal lines; edge cells may differ in size.
3. A 10 × 10 grid appears on every image preview and palette map and is included in exported PNG files.
4. Empty dimensions or invalid division counts produce an explanatory status.
5. In Crop mode, moving or resizing the frame never extends outside the image; tone analysis, palette maps, and exports use the selected region, while the original file remains intact.
6. In Change canvas size mode, the complete source image remains visible within the frame, added area is visibly blank and excluded from palette-area calculations, and movement never clips source pixels.
7. Dragging, proportional resizing, and keyboard adjustments preserve the planned aspect ratio. The outside-frame overlay remains visible, and the framing state restores after reload.
8. Changing planned dimensions updates the frame ratio, preserves its position/size as far as mode constraints allow, and visibly reports any required clamping.
9. A project with no selected framing operation continues to use the full source image. Restoring this state removes framing effects from downstream analysis and maps without changing the uploaded file.
