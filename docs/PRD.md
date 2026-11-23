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
3. Suggest mixes from the user's paint inventory and estimate total consumption.
4. Where suitable optical data is available, provide a physically informed paint-mixing estimate based on Kubelka–Munk theory, with its assumptions and uncertainty clearly stated.
5. Export palette maps with the selected guides.
6. Keep product requirements technology-independent so the MVP can be replaced by another implementation.

### Non-goals for the MVP

- Claiming laboratory accuracy for physical pigment mixing, opacity, transparency, drying, or brand-specific paint behavior.
- Predicting actual paint consumption with laboratory accuracy.
- Automatically creating a finished painting or replacing artistic judgment.
- Cloud synchronization, collaborative editing, accounts, or community features.
- Tracking paint inventory quantities or stock alerts. The MVP stores paint details but does not track remaining grams or milliliters.

## 5. Primary user workflow

1. Upload a reference image and optionally a photo of the work in progress.
2. Set the planned canvas dimensions, then choose and adjust a reference crop or expanded-canvas frame.
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
- Never overwrite the original image. Framing changes are non-destructive and define the derived view used by composition, analysis, and map generation.

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
- Treat HEX/RGB swatches as display values only; they are not enough to infer product-specific spectral behavior.

### FR-06 — Palette and paint consumption

- Allow users to enter a total planned paint quantity in grams or milliliters.
- The first table shows each palette color's number, color identifier/HEX, percentage of image area, and estimated quantity, sorted by descending quantity.
- The second table shows total estimated quantities for paints used in the mixing plans, including paint name and pigment/product code, sorted by descending quantity.
- Estimate quantities from the user-entered total and the relative color areas. Split each mix across its components according to the suggested proportions, then aggregate by paint.
- For a Kubelka–Munk recipe, interpret proportions by mass. Convert to milliliters only with product-specific densities and a documented volume assumption.
- If palette data, paint inventory, or a valid quantity is missing, explain what is needed instead of showing misleading zero results.

### FR-07 — Export

- Allow the combined numbered map and each per-color map to be downloaded separately as PNG files.
- Reflect the currently selected contour and grid settings in exports.

### FR-08 — Persist project settings

- Preserve the project's composition dimensions and grid settings, palette source and size, contour setting, total paint quantity and unit, and in-progress paint form draft.
- Preserve the reference framing operation, frame scale, and horizontal/vertical position for the selected reference asset.
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

### FR-11 — Physically informed paint-mixing model

- Add a separately versioned Kubelka–Munk-based model for predicting the result of mixing real paint products when adequate optical data is available.
- Represent optical properties across a documented visible-wavelength grid. Prefer product-specific spectral reflectance and/or absorption (`K`) and scattering (`S`) data with provenance; do not infer measured physical properties from a HEX value or pigment name alone.
- Combine paint coefficients according to declared paint-product mass fractions, then predict the mixture reflectance using a documented Kubelka–Munk layer model and stated substrate/thickness assumptions.
- Convert predicted reflectance to a displayed color under a documented standard illuminant and observer. Use CIE D65 and the CIE 1931 2° observer as the proposed default. Optimize one- or two-paint recipes against the target using a perceptual color-difference metric, such as CIEDE2000.
- Define mixing ratios by mass. Convert volume-based inputs only when product-specific density is available; otherwise explain why a physical estimate cannot be produced.
- Distinguish measured, derived, and synthetic optical data. Display model/data provenance, model version, and a clear uncertainty/approximation notice.
- If adequate spectral data is unavailable, the application may offer the existing RGB estimate, but must label it as an RGB approximation and must not present it as a Kubelka–Munk prediction.
- Keep paint-quantity/coverage estimation separate: a color-mixing model does not predict the amount of paint needed to cover a canvas.
- Keep user paint data and source images local. A remote paint-data catalogue requires a separate privacy decision and documentation.

### FR-12 — Crop and change canvas size

- Use the planned canvas width-to-height ratio as the locked aspect ratio of an interactive reference frame.
- Provide two explicit operations:
  - **Crop:** keep the frame within the reference image and use the selected image region as the reference for composition, tone analysis, palette extraction, and map export. Never modify the uploaded source file.
  - **Change canvas size:** preserve the complete reference image and enlarge the canvas frame around it. Show added canvas area as blank/unpainted; do not synthesize image pixels or treat the blank area as a palette color.
- Keep the frame aspect ratio locked while the user proportionally enlarges or reduces it. Support dragging to reposition it horizontally and vertically relative to the reference.
- Clamp movement and resizing so Crop never extends beyond the source image, while Change canvas size never clips the complete source image and can be reduced only as far as the smallest frame that still contains it.
- If planned dimensions change the target ratio, preserve the frame center and size where possible, recompute the locked-ratio boundary, and clamp to the selected mode's valid limits with visible feedback.
- Dim or fade the area outside the active frame. Clearly distinguish the blank canvas extension inside the frame from the dimmed outside area.
- Provide pointer/touch dragging and proportional corner handles, plus keyboard-accessible sliders and numeric controls for frame scale and horizontal/vertical position.
- Provide reset-to-mode-default and restore-full-image actions.
- Until the user selects an operation, keep the full image as the downstream source; allow restoring this unmodified state after framing.
- Persist operation, frame scale, and position with the project and the reference asset they belong to. Replacing the reference image must not silently apply stale framing coordinates to the new image.
- Update all affected previews, analysis, palette maps, and exports when the operation or frame changes. Planned physical dimensions determine aspect ratio, not output pixel resolution.
- Include crop geometry and source-asset revision in derived-analysis/cache identity so stale full-image or previous-crop results cannot be reused.

## 7. Quality requirements

- **Clarity:** Grid names and spacing in centimeters must be unambiguous. Invalid custom values must have visible feedback.
- **Transparency:** Clearly identify digital mixing and consumption figures as estimates near the calculations.
- **Color science:** Version the physical mixing algorithm and its optical datasets; record measurement conditions, model assumptions, and data provenance. Never present an inferred/synthetic spectrum as a measured paint spectrum.
- **Privacy:** The MVP processes images locally and does not upload them to a server. Future data handling and synchronization require a separate decision.
- **Reliability:** Changes to settings must update all affected previews and exports; stale downloads must not remain active.
- **Image framing:** The original image is immutable; crop and canvas extension must remain visually distinct and produce consistent downstream results.
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
- For paints with sufficient optical data, the physical model predicts a spectral mixture and a perceptual comparison under its declared illuminant/observer; RGB-only paints remain explicitly labeled as approximations.
- Crop mode uses only the selected reference region downstream; Change canvas size preserves every source pixel and treats added canvas as unpainted/unassigned.
- Users can resize and reposition the locked-ratio frame in both modes; boundaries and outside-area dimming remain clear at all supported viewport sizes.
- Missing data and invalid settings result in explanatory states.

Detailed behavior is specified in [image analysis and composition](specs/image-composition.md), [palette and paint planning](specs/palette-and-paint-planning.md), [maps and export](specs/maps-and-export.md), [workspace and localization](specs/workspace-and-localization.md), and the [MVP and migration baseline](specs/current-mvp-and-migration.md).

## 9. Current MVP status

The repository includes a static, client-side browser prototype (`index.html`, `styles.css`, and `app.js`) and an active TypeScript implementation under `src/`. The TypeScript workspace supports image upload, aspect-ratio and grid guides, tone comparison, numbered and per-color palette maps, PNG export, a personal paint inventory, and consumption tables. Paint planning defaults to a labeled linear-RGB fallback and includes an optional, separately versioned, single-constant Kubelka–Munk estimate using sourced spectral reflectance, mass ratios, D65 / CIE 1931 2° colorimetry, and CIEDE2000. The initial model has not yet been validated against a measured reference set. Images are processed locally; project data is stored in browser storage, with optional user-selected project-folder access.

This describes the current starting point, not a requirement that future product versions use the same technology.

## 10. Open decisions for future product versions

- Target platforms, technology stack, and boundaries between client-side and server-side processing.
- Supported image formats, maximum input size, export resolution, and printability.
- Whether cloud storage, accounts, cross-device synchronization, or data retention are needed.
- Sources and licensing for paint databases, community/manufacturer color data, and custom paint imports.
- Feasibility and accuracy of a physical pigment model and calibrated color management.
- Sources, formats, and licensing for product-specific reflectance or Kubelka–Munk coefficient data; the target accuracy and benchmark set for model validation.
- Whether the first physical-model release assumes an optically thick layer with constant scattering, or supports finite layer thickness and substrate reflectance.
- Whether paint ratios will always be entered by mass and which density sources, if any, can support volume conversion.
- Whether to track remaining paint quantities, usage, or a waste allowance.
- The default fill/appearance of added canvas area (for example, paper white, transparent, or user-configurable) and whether that choice is exported.
- Whether a new project should prompt for a framing operation or simply remain in the unmodified full-image state until the user chooses one.
- Palette-size range, user-defined palette names, and screen-reader/print formats.
- Success metrics and target outcomes for user testing.
