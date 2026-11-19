# Specification: Workspace and Localization

## Workflow

The project workspace follows the order of painting preparation:

1. Upload the reference image and the image of the work in progress.
2. Review aspect ratio, canvas dimensions, grid, and tone analysis.
3. Generate a palette and numbered/per-color maps.
4. Review the paint inventory, mixing suggestions, and quantity estimates.

Visible, responsive, keyboard-accessible section navigation links to the main steps. Image-upload thumbnails show the complete image and preserve its original aspect ratio.

## Project settings

- The complete composition settings, palette source and requested color count, contour visibility, paint quantity and unit, and in-progress paint form are project metadata.
- Save metadata automatically to local IndexedDB after a short delay.
- Restore the latest saved state after switching projects or reloading the page.
- Paint inventory and mixing notes are separate project data and are also stored locally.

## Supported languages

- The interface is available in English (`en`), Slovak (`sk`), Czech (`cs`), and Hungarian (`hu`).
- English is the default; the browser language is not detected automatically.
- Persist the language selected by the user in browser local storage.
- Translation resources use `i18next` / `react-i18next`, with English as the default and fallback language.
- Visible text, status and error messages, document title and language, and accessibility labels follow the current locale.
