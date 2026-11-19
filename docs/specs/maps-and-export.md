# Specification: Palette Maps and Export

## Map types

### Combined numbered map

- Assign every pixel in the image to one of a limited number of palette groups.
- Show palette areas as discrete regions.
- Give each palette color present in the image a number; position markers to avoid overlap where possible.

### Per-color maps

- Create a separate image for each palette color.
- Use a faded version of the selected source image as the background.
- Highlight regions assigned to that color with high-contrast, dense diagonal hatching.
- Show the number only in a single corner marker, not repeatedly across the regions.

## Layers and guides

- Contour emphasis is optional and applies to both combined and per-color maps.
- Show the selected aspect-ratio frame and grid on combined and per-color maps.
- The grid, frame, and contours are visual overlays above the current map layers; they do not change palette segmentation.
- Keep markers and color areas legible; grid lines must not obscure palette numbers.

## Updates and export

- Each map can be downloaded separately as a PNG.
- The TypeScript application stores palette data in IndexedDB. When a project folder is attached, numbered and per-color PNG maps are automatically saved under `generated/palettes`.
- Restore the most recently saved palette and maps for the current source image after switching projects or reloading the application.
- Include the map type or palette number in the filename.
- Exported content must match the current palette, contour, aspect-ratio, and grid settings.
- After a setting changes, an old export link must not continue to serve a stale image.
- Show an explanatory state when export fails or the source image is missing.

## Current MVP baseline

- The longest side of palette maps is 1000 px.
- The combined map and per-color maps use PNG format.
- Either the reference image or the in-progress image can be selected as the palette source.

## Acceptance examples

1. With six palette colors, create one combined map and six per-color maps.
2. If enabled/selected, the grid appears on all seven maps.
3. After contours are disabled, none of the maps contain the contour layer, while the grid remains.
4. Every PNG contains the same map shown on the current canvas.
