# Product Requirements Document

## 1. Purpose and status

This document records product-level requirements for an application that supports painting from references. The behavior of the current browser-based MVP is a starting point; requirements for future versions are not tied to its implementation.

**Status:** Draft, based on the needs gathered so far and the MVP. Open product and technology decisions are listed in Section 10.

## 2. Product vision

Help artists intentionally translate the composition, tones, and colors of a reference image onto their own canvas. Support the full workflow: choosing an aspect ratio and grid, planning a limited palette, reviewing oil-paint mixing suggestions, and estimating the required paint quantities.

The application is a decision-support tool. The artist makes the final composition and paint choices. Mixing ratios and consumption estimates derived from screen colors are approximations and do not replace physical test mixes.

## 3. Target users and needs

- **Artists working from a reference:** compare composition, aspect ratio, and tones with the work in progress.
- **Artists using a grid or numbered plan:** get proportional guides, distinct color regions, and maps that can be saved or printed.
- **Oil painters:** use their own inventory to plan approximate mixes for palette colors and estimate quantities for the painting.

## 4. Goals and non-goals

### Goals

1. Make it easy to compare the composition and tones of a reference and an in-progress painting.
2. Produce a numbered, limited-color palette and area maps.
3. Suggest approximate mixes from user-entered oil paints and estimate total consumption.
4. Export palette maps with the selected guides.
5. Keep product requirements technology-independent so the MVP can be replaced by another implementation.

### Non-goals for the MVP

- Accurately simulating physical pigment mixing, opacity, transparency, drying, or brand-specific paint behavior.
- Predicting actual paint consumption with laboratory accuracy.
- Automatically creating a finished painting or replacing artistic judgment.
- Cloud synchronization, collaborative editing, accounts, or community features.
- Tracking paint inventory quantities or stock alerts. The MVP stores paint details but does not track remaining grams or milliliters.

## 5. Primary user workflow

1. Upload a reference image and optionally a photo of the work in progress.
2. Set the target aspect ratio or planned canvas width and height in centimeters.
3. Choose guides or a grid, or enter custom column/row counts or a grid spacing in centimeters.
4. Choose the number of palette colors, generate the color maps, and review the numbered and per-color maps.
5. Add available paints to a personal inventory and review suggested mixes for the palette colors.
6. Enter a total planned paint quantity and unit; review estimates by palette color and by paint.
7. Download the palette maps as PNG files.

## 6. Functional requirements

### FR-01 — Image import and comparison

- Users can upload a reference image and an image of the work in progress.
- The upload area shows a proportionally scaled thumbnail of the complete image and its aspect ratio.
- Composition frames and selected guides appear over the images.
- Users can compare the aspect ratios and tone distributions of the reference and in-progress images.
- Original image content remains unchanged; guides affect only previews and exported maps.

### FR-02 — Aspect ratio, dimensions, and grids

- Provide common aspect ratios, an unconstrained view, and a custom aspect ratio calculated from planned dimensions in centimeters.
- Allow users to enter canvas width and height in centimeters.
- Provide rule-of-thirds, 4 × 4, 6 × 6, 8 × 8, and 10 × 10 grids; diagonal guides; no-grid view; custom column/row counts; and a square grid with spacing in centimeters.
- Show the distance between adjacent lines in centimeters when it can be calculated from the canvas dimensions.
- Apply selected guides to previews and exported palette maps.

### FR-03 — Tone comparison

- Show comparable tone profiles for the reference and in-progress images using the same clearly labeled ranges.
- Present differences as indicative measurements derived from screen images, not as measurements of the physical painting.

### FR-04 — Limited palette and color regions

- Reduce the colors of either the reference or in-progress image to a limited palette.
- Give each palette entry a number and a clear swatch/HEX value.
- Create a combined numbered map with discrete color regions and one map for each palette color.
- On each per-color map, highlight the relevant regions with high-contrast hatching over a faded image.
- Make contour emphasis optional. Show the palette number once in a corner marker on per-color maps.

### FR-05 — Personal oil-paint inventory and mixing plan

- Allow users to enter a paint manufacturer, color name, pigment/product code, and digital swatch.
- Suggest a mix for each palette color using one or two paints from the inventory.
- Show the paints used, their proportions, and an approximate difference from the target screen color.
- Keep the paint inventory and saved mixing notes locally in the MVP.

### FR-06 — Palette and paint consumption

- Allow users to enter a total planned paint quantity in grams or milliliters.
- The first table shows each palette color's number, color identifier/HEX, percentage of image area, and estimated quantity, sorted by descending quantity.
- The second table shows total estimated quantities for paints used in the mixing plans, including paint name and pigment/product code, sorted by descending quantity.
- Estimate quantities from the user-entered total and the relative color areas. Split each mix across its components according to the suggested proportions, then aggregate by paint.
- If palette data, paint inventory, or a valid quantity is missing, explain what is needed instead of showing misleading zero results.

### FR-07 — Export

- Allow the combined numbered map and each per-color map to be downloaded separately as PNG files.
- Reflect the currently selected contour and grid settings in exports.

### FR-08 — Persist project settings

- Preserve the project's composition dimensions and grid settings, palette source and size, contour setting, total paint quantity and unit, and in-progress paint form draft.
- Automatically save settings to the local project database after a short delay.
- Restore saved settings after switching projects or reloading the page. Also preserve the paint inventory and per-color mixing notes.

### FR-09 — Internationalized interface

- Support English, Slovak, Czech, and Hungarian, with English as the default.
- Persist the language selected by the user locally and restore it after reload.
- Start in English if there is no saved selection; do not override the default based on the browser language.
- Show all user-facing text—including controls, status messages, errors, and accessibility labels—in the current language.

### FR-10 — Workflow and navigation

- Arrange the interface in painting workflow order: image upload, composition and tone review, palette and maps, then paint planning.
- Provide visible, keyboard-accessible navigation between sections.

## 7. Quality requirements

- **Clarity:** Grid names and spacing in centimeters must be unambiguous. Invalid custom values must have visible feedback.
- **Transparency:** Clearly identify digital mixing and consumption figures as estimates near the calculations.
- **Privacy:** The MVP processes images locally and does not upload them to a server. Future data handling and synchronization require a separate decision.
- **Reliability:** Changes to settings must update all affected previews and exports; stale downloads must not remain active.
- **Persistence:** Project metadata must not need to be re-entered after a reload or project switch.
- **Internationalization:** User-facing strings must come from resources; support English, Slovak, Czech, and Hungarian.
- **Accessibility:** Provide labeled controls, keyboard interaction, status announcements, and sufficient contrast.
- **Extensibility:** Requirements must not mandate the current browser technology or RGB mixing algorithm.

## 8. Acceptance criteria

- Users can choose a grid that fits the planned image dimensions and verify the calculated line spacing.
- Palette maps show the same selected guides as the composition preview.
- Exported combined and per-color PNG maps reflect the selected settings.
- The area percentages for a limited palette total 100%, allowing for rounding.
- The paint-consumption table distributes the same planned total as the palette table according to the selected mixing ratios.
- Missing data and invalid settings result in explanatory states.

Detailed behavior is specified in [image analysis and composition](specs/image-composition.md), [palette and paint planning](specs/palette-and-paint-planning.md), [maps and export](specs/maps-and-export.md), [workspace and localization](specs/workspace-and-localization.md), and the [MVP and migration baseline](specs/current-mvp-and-migration.md).

## 9. Current MVP status

The repository includes a static, client-side browser prototype (`index.html`, `styles.css`, and `app.js`) and an active TypeScript implementation under `src/`. The TypeScript workspace supports image upload, aspect-ratio and grid guides, tone comparison, numbered and per-color palette maps, PNG export, a personal paint inventory, approximate mix suggestions, and consumption tables. Images are processed locally; project data is stored in browser storage, with optional user-selected project-folder access.

This describes the current starting point, not a requirement that future product versions use the same technology.

## 10. Open decisions for future product versions

- Target platforms, technology stack, and boundaries between client-side and server-side processing.
- Supported image formats, maximum input size, export resolution, and printability.
- Whether cloud storage, accounts, cross-device synchronization, or data retention are needed.
- Sources and licensing for paint databases, community/manufacturer color data, and custom paint imports.
- Feasibility and accuracy of a physical pigment model and calibrated color management.
- Whether to track remaining paint quantities, usage, or a waste allowance.
- Palette-size range, user-defined palette names, and screen-reader/print formats.
- Success metrics and target outcomes for user testing.
