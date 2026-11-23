# Specification: Current MVP and Migration

## Current technical baseline

- The original MVP is a static, client-side browser application in `index.html`, `styles.css`, and `app.js`.
- The active implementation is a Vite, React, and TypeScript application under `src/`.
- The current composition frame is a preview guide; interactive Crop and Change canvas size operations are not yet implemented.
- The TypeScript application processes images in the browser. It does not upload source images to a server.
- Project data is stored locally in IndexedDB. A user-selected project directory can be used through the File System Access API where available; local browser storage is the fallback.
- Palette grouping uses RGB-based k-means. Paint planning defaults to linear-RGB interpolation and also offers an explicitly selected, single-constant Kubelka–Munk estimate when sourced reflectance data is entered.
- Paint records can store reflectance samples on a 380–780 nm, 10 nm grid, provenance, source, the diffuse/infinite-layer assumption, and optional density. HEX-only records remain unchanged and are excluded from Kubelka–Munk suggestions.
- The initial Kubelka–Munk mode converts reflectance to `K/S`, assumes shared constant scattering, mixes by mass, and reports a D65 / CIE 1931 2° preview with CIEDE2000. It is not yet validated against a measured reference set.
- Tone analysis uses five brightness ranges. Composition grids and maps are drawn on canvas.

## Important limitations

- A HEX swatch does not fully describe physical paint. There is no pigment database or calibrated color profile.
- Existing HEX-only paint records cannot be treated as measured spectral data or assigned invented Kubelka–Munk coefficients.
- Estimated paint quantity is derived from image-area proportions and approximate mix ratios, not measured paint usage.
- Paint names can be stored, but remaining inventory and consumption are not tracked.
- Palette colors currently use their number and HEX value as identifiers; user-defined aliases are not supported.
- The application retains project data locally in the browser. Folder-backed source files depend on the user's selected folder and browser permissions.

## Migration principles

1. Treat user outcomes and acceptance criteria in the PRD as primary, not the current DOM or canvas implementation.
2. Keep image processing, segmentation, composition guides, mixing suggestions, and consumption estimates in separately testable areas.
3. Give domain data explicit units and identifiers: image dimensions (cm), grid layout, palette color, paint, mixing recipe, area ratio, and quantity (g/ml).
4. Keep the color-mixing model replaceable independently of the UI and export. Reassess uncertainty and accuracy whenever the model changes.
5. Keep RGB and Kubelka–Munk as separately labeled, versioned models. Preserve spectral-data provenance and never infer measured product data from a HEX swatch.
6. Keep the image pipeline platform-independent. When choosing client, desktop, or server-side processing, plan image privacy, storage, and export separately.
7. Use automated tests to protect consistency between PNG exports and their visible on-screen state.
8. Technology stack, offline behavior, accounts, backup, and synchronization are not implied by the original MVP and require explicit decisions.

## Suggested domain concepts

- **Project:** images, planned canvas dimensions, aspect ratio, grid and palette settings.
- **ReferenceFrame:** source-asset identity, optional operation (`crop` or `extend-canvas`; absent means unmodified full image), target-ratio scale, and image-relative position.
- **Paint:** manufacturer, name, pigment/product code, swatch, optional inventory quantity, and (for physical mixing) product-specific optical data with provenance.
- **PaletteEntry:** stable number/identifier, swatch, pixel count, and area ratio.
- **MixRecipe:** target palette color, one or two paint identifiers, component proportions, and model-specific error.
- **MapExport:** source image, palette version, selected grid/contour settings, and output format.

These are conceptual boundaries, not required class names or technology APIs.

## Kubelka–Munk implementation status

The initial physical-mixing behavior and remaining extensions are specified in [palette and paint planning](palette-and-paint-planning.md). Existing RGB-only records migrate unchanged and remain available through the clearly labeled RGB fallback until compatible optical data is supplied. The reference projects [Spectral.js](https://github.com/rvanwijnen/spectral.js) and [Mixbox](https://github.com/scrtwpns/mixbox) are inspiration only; review licenses before reusing code or assets.

## Future crop and canvas-size direction

The framing requirements are specified in [images, composition, and grids](image-composition.md#crop-and-canvas-size-frame). They extend the current non-destructive preview guide. A future implementation must preserve the original source asset, bind saved frame coordinates to that asset, and distinguish a selected crop from unpainted canvas extension. Existing projects without a framing choice must continue using the full source image until the user explicitly selects an operation.

## TypeScript workspace persistence and localization

- Project composition settings and workspace metadata are stored in a versioned project record in Dexie/IndexedDB. Database migrations supply defaults for older projects.
- Palette and paint-planning settings are saved automatically. Paint inventory and mixing notes are stored in separate local tables.
- The interface uses `i18next` and `react-i18next` resources. Supported languages are `en`, `sk`, `cs`, and `hu`; English is the default when no explicit selection exists.
- The selected language is stored in browser local storage and does not depend on the browser-reported language.
- Workspace and primary navigation order: images, composition/tone, palette/maps, then paint planning.
