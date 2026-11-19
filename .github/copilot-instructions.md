# Copilot instructions

## Project shape

The active implementation is a Vite + React + TypeScript application under `src/`. The root `app.js`, `styles.css`, and the former static UI are the completed MVP reference; do not extend those files for new product work. Product behavior remains documented in `docs/PRD.md` and `docs/specs/`.

The new implementation is local-first and browser-only. Images are processed in a Web Worker, project metadata and analysis cache are stored with Dexie/IndexedDB, and a user-selected project directory is used through the File System Access API when supported. Tailwind CSS provides the UI utility layer while the visual language remains aligned with the MVP.

## Commands

- `npm install` — install dependencies.
- `npm run dev` — start the Vite development server.
- `npm run typecheck` — run strict TypeScript project checks.
- `npm run lint` — lint `src/` and the TypeScript configuration files.
- `npm test` — run unit tests with Vitest.
- `npm test -- src/domain/schemas.test.ts` — run one unit-test file.
- `npm run build` — typecheck and create the production bundle.
- `npm run test:e2e` — run Playwright browser tests; the config starts a Vite server automatically.

## Architecture

- `src/domain/` contains framework-independent entities, branded IDs, Zod schemas, revisions, and factory functions. Domain contracts use version fields so IndexedDB records and Worker payloads can evolve deliberately.
- `src/application/` contains use-case orchestration. `project-service.ts` coordinates project creation, asset import, storage fallback, Worker analysis, and cache persistence without putting those rules in React components.
- `src/image-processing/` contains pure RGBA analysis, the typed Worker protocol, the Worker implementation, and the main-thread `ImageProcessingClient`. Worker messages have a protocol version, request ID, progress events, cancellation, and structured error codes.
- `src/features/composition/` contains the pure aspect/grid geometry calculations and responsive canvas preview. `Project.composition` persists the active frame and grid; Dexie schema migrations provide defaults for projects created by earlier versions.
- `src/storage/` hides Dexie, File System Access API, and fallback blobs behind repositories/adapters. The standard project directory layout is `source/reference`, `source/artwork`, `generated/palettes`, and `generated/exports`. File-system handles stay in storage bindings and must not enter domain entities.
- `src/app/` contains the Zustand application store and the React foundation UI. Keep Zustand focused on UI/application state; keep calculations and persistence in the domain/application/storage layers.
- `tests/e2e/` contains Playwright flows. Unit tests should cover pure domain and image-processing behavior without requiring a browser canvas.

## Data and storage conventions

- Projects, assets, analyses, fallback blobs, and storage bindings are separate Dexie tables. Validate project, asset, and analysis records with their Zod schemas at repository boundaries.
- `ProjectAsset` stores the asset role, file name, relative path, MIME type, size, last-modified timestamp, storage mode, and optional dimensions/hash. Source image bytes are filesystem files when possible or fallback blobs when necessary.
- Analysis cache identity includes the asset ID, asset revision, and analysis algorithm version. Invalidate or version caches when an image-processing algorithm changes.
- The File System Access API is optional. User cancellation is not an application error; unavailable permissions or write failures should fall back to IndexedDB and show a visible warning in the selected UI language.
- Preserve local processing and privacy: do not upload source images or introduce a backend without updating the PRD and migration documentation.

## Implementation conventions

- Use strict TypeScript and explicit `import type` imports. Prefer branded IDs and typed ports over stringly typed cross-layer calls.
- Keep Worker code DOM-independent. Pass `Blob` inputs through the typed protocol, report progress for long operations, and return structured errors instead of throwing across the Worker boundary.
- Use React components for orchestration and presentation, not for image algorithms, storage details, or business calculations.
- Keep user-facing text localized through the translation resources, with English as the default and Slovak, Czech, and Hungarian also supported. Preserve accessible labels/status messaging. Generated UI should use React text nodes rather than unsafe HTML injection.
- Preserve the current product caveats: RGB/HEX mixing and consumption are approximations, not physical pigment simulation or laboratory measurements.
- Keep the README and technical documentation in English by default. When behavior changes, update the relevant PRD/specification and add focused unit or Playwright coverage for the changed contract.
