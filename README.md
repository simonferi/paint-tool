# Paint Tool

A local-first painting workspace for planning a painting from reference images. Compare composition and tones, create a limited palette and paint maps, and estimate paint mixes and quantities using your own paint inventory.

The active application is a Vite, React, and TypeScript project under `src/`. The original static MVP at the repository root is retained as a product reference; new application work belongs in `src/`.

## Features

- Import a reference image and an optional in-progress artwork image.
- Review full, aspect-ratio-preserving thumbnails, image dimensions, tone analysis, composition frames, and grid guides.
- Extract a limited palette and view numbered and per-color area maps.
- Export palette maps as PNG files and, when supported, save generated files to a project folder.
- Maintain a local paint inventory, review approximate mix suggestions, add mixing notes, and estimate paint quantities.
- Save project settings, image metadata, analyses, palettes, paint inventory, and notes locally.
- Use the interface in English, Slovak, Czech, or Hungarian. English is the default.

## Privacy and limitations

Image analysis runs locally in a Web Worker. Project data and analysis caches are stored in the browser with IndexedDB. When supported, the File System Access API can connect a folder selected by the user; otherwise, local IndexedDB storage is used. Source images are not uploaded to a server.

Digital RGB/HEX mixing and paint-consumption figures are estimates, not physical pigment simulations, laboratory measurements, or substitutes for test mixes.

## Requirements

- Node.js and npm.
- A modern browser with Web Worker, Canvas, and IndexedDB support.
- File System Access API support is optional; the application falls back to local browser storage.

## Getting started

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Create a project, add an image, and follow the workspace steps from composition planning through palette and paint planning.

## Development commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server. |
| `npm run typecheck` | Run strict TypeScript project checks. |
| `npm run lint` | Lint the application and TypeScript configuration. |
| `npm test` | Run unit tests with Vitest. |
| `npm run test:e2e` | Run Playwright browser tests; the configuration starts a Vite server. |
| `npm run build` | Typecheck and create the production bundle. |
| `npm run preview` | Preview the production bundle locally. |

## Architecture

- `src/domain/` — versioned domain contracts, schemas, identifiers, and pure calculations.
- `src/application/` — use-case orchestration for projects, assets, analysis, and persistence.
- `src/image-processing/` — pure image analysis, a typed Worker protocol, and the Web Worker client.
- `src/features/` — composition, palette, and paint-planning workflows.
- `src/storage/` — Dexie repositories, IndexedDB fallback storage, and optional project-folder access.
- `src/app/` — React application shell and UI state.
- `src/i18n/` — English, Slovak, Czech, and Hungarian translation resources.
- `tests/e2e/` — Playwright user-flow tests.

See the [product requirements](docs/PRD.md) and the [technical specifications](docs/specs/) for product behavior and design details.

## License

This project is distributed under the MIT License. See [LICENSE](LICENSE).
