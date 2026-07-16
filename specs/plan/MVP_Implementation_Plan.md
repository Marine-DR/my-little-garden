# MyLittleGarden — Strict MVP Implementation Plan

## Summary

Build an offline Windows/Linux desktop application for one gardener using Electron, React, TypeScript, and SQLite. The MVP covers:

- Viewing the complete plant catalog with photos and pagination.
- Filtering by soil, exposure, and flowering month.
- Atomically replacing the catalog from CSV plus an image folder.
- Creating uniquely named plant selections from checked catalog plants.
- Managing saved selections in a table-based “Mes Sélections” screen.

The domain and import logic will remain independent of Electron so it can later be reused by a Node-based server.

## Architecture and Interfaces

- Use an npm workspace split into:
  - Electron main process for SQLite, filesystem access, dialogs, and import staging.
  - React renderer with no direct Node access.
  - Framework-neutral TypeScript core containing entities, validation, filtering, and replacement rules.
  - Typed preload/IPC boundary connecting the renderer to application services.
- Store the SQLite database and managed images under Electron’s platform-specific application-data directory.
- Use UUIDs for plants and selections, foreign keys, transactions, and versioned database migrations.
- Centralize French interface strings through an i18n layer; ship French only in the MVP.

Core interfaces:

- `previewCatalogReplacement(csvPath, imageDirectory): ImportPreview`
- `commitCatalogReplacement(previewId): ImportResult`
- `listPlants(filters, page): PaginatedPlants`
- `createSelection(name, plantIds): Selection`
- `addPlantsToSelections(selectionIds, plantIds): SelectionAddResult`
- `listSelections(): SelectionSummary[]`
- `getSelection(selectionId): SelectionDetails`
- `removePlantsFromSelection(selectionId, plantIds): SelectionDetails`

## Data and Import Behavior

- Model all defined plant attributes: identity, name, photo, optional minimum/maximum height, type, flower/other category, soils, exposures, minimum temperature, optional flowering interval, flower and foliage colors, foliage persistence, spacing, and planting seasons.
- Require a unique name, one or more soils, and one or more exposures. Treat other fields, flowering dates, and photos as optional, showing placeholders where absent.
- Provide a downloadable UTF-8 CSV template. Use semicolon as the exported separator, accept semicolon or comma on import, and use `|` inside multi-value cells.
- Support an optional `plant_id` UUID:
  - Match existing plants by UUID first.
  - If absent, match by trimmed, case- and accent-insensitive unique name.
  - Generate a UUID for genuinely new plants.
  - Reject duplicate or conflicting identifiers and names.
- Match `photo_filename` against the selected image folder, accepting JPG, JPEG, PNG, and WebP. Copy matches into managed storage under UUID-based filenames.
- Missing or unmatched photos produce warnings and placeholders; malformed rows, missing core fields, invalid enum/range values, duplicate identities, and unsafe paths are blocking errors.
- Stage and fully validate CSV and images before mutation. A replacement containing blocking errors cannot be committed.
- The preview reports created, updated, removed, warning, and error counts plus affected selections.
- Commit catalog and selection-link changes in one transaction:
  - Preserve selection links for matched plants.
  - Remove links to plants absent from the replacement.
  - Retain selections that become empty and show them as containing zero plants.
  - Clean up obsolete managed images only after a successful commit.

## User Experience

- Fresh installations open an empty-state onboarding screen with CSV-template download and replacement actions.
- Catalog screen follows the existing French visual guidelines:
  - Fixed application header and catalog table header.
  - Complete plant attributes, photo fallback, and horizontal scrolling where required.
  - 25 rows per page with 25/50/100 options.
  - Multi-select checkboxes for creating selections.
- Filters allow multiple values:
  - OR between values within one category.
  - AND between soil, exposure, and flowering categories.
  - Flowering matches when a plant blooms during any selected month, including intervals crossing December.
  - Active filters are visible and individually or collectively removable.
- Selection creation requires at least one checked plant and a non-empty name unique after trimming and case normalization.
- Empty selections cannot be created from “Mes Sélections” in the MVP.
- The catalog selection action bar supports creating a new selection and adding checked plants to one or more existing selections. Existing plant-selection links are ignored without producing an error.
- “Mes Sélections” displays saved selections and their current plants in a table-based management screen. Users can open a selection detail and remove plants from a selection after confirmation.
- Selection rename, selection deletion, selection reliability status, modified/deleted plant review, flowerbed usage indicators, selection search, selection filters, and card/table view switching are deferred.
- Confirm catalog replacement after preview, especially when saved selections will lose plants.
- Keep layouts usable across ordinary desktop sizes; mobile navigation and touch-specific behavior are deferred.

## Test Plan

- Unit-test CSV parsing, enum and range validation, cyclic flowering periods, name normalization, UUID precedence, duplicate detection, and filter combination rules.
- Test replacement transactions for new, matching, renamed, removed, incomplete, and invalid plants.
- Verify preserved and removed selection links, including selections becoming empty.
- Verify empty selection creation is rejected and duplicate normalized selection names are rejected.
- Verify adding catalog plants to existing selections ignores duplicate links and reports added versus ignored associations.
- Verify removing plants from a selection requires confirmation and updates the selection detail.
- Test image matching, missing images, duplicate filenames, unsupported formats, path traversal, copying, and cleanup after commit or rollback.
- Component-test empty, loading, populated, filtered, paginated, validation, preview, and selection states.
- Electron integration-test:
  - Fresh installation and template download.
  - Successful catalog replacement.
  - Failed replacement leaving existing data untouched.
  - Creating and reopening a saved selection.
  - Adding checked catalog plants to an existing selection.
  - Removing plants from a saved selection.
  - Replacing a catalog while preserving and removing appropriate links.
- Produce Windows x64 installer and Linux x64 AppImage smoke builds.

## Deferred Features and Assumptions

- Exclude individual plant CRUD, additive/update/delete CSV modes, ZIP image import, search, sorting, configurable columns, selection rename, selection deletion, selection reliability status, selection card view, flowerbed design, generated documents, accounts, synchronization, and hosted services.
- The application works entirely offline and has one local data owner.
- Imported horticultural values use the controlled vocabulary defined by the existing catalog specification; internal enum keys remain language-neutral.
- No starter plant dataset or licensed imagery is bundled.
