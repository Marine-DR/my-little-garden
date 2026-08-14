# SQL query catalog

Production SQL is limited to `packages/database/src` and the desktop database
bootstrap. This catalog identifies each query owner and the reason dynamic SQL
is used where a fully static prepared statement is not possible.

## Catalog reads

`packages/database/src/catalog-queries.ts` owns all hydrated catalog reads:

- total plant count, filtered total, filtered IDs, pages, lookup by IDs, and
  lookup by normalized name;
- soil, exposure, bloom-month, plant-kind, flower-color, and leaf-color filter
  options;
- batch hydration of kinds, soils, colors, exposures, and planting seasons.

The common plant projection, joins, and ordering are assembled once by
`selectCatalogScalars`. Filter clauses are built only from fixed SQL fragments;
filter values remain prepared-statement parameters.

## Catalog writes and selection-change snapshots

`packages/database/src/catalog-writer.ts` owns operations shared by incremental
catalog imports and full catalog replacement:

- plant upsert;
- allowlisted vocabulary lookup and creation;
- deletion and recreation of plant kinds, soils, exposures, flower colors,
  leaf colors, and planting seasons.

The vocabulary table is a TypeScript union backed by a fixed query map. Callers
cannot supply a table identifier for interpolation.

`packages/database/src/selection-change-writer.ts` owns deletion snapshots and
the corresponding selection timestamp update. Both single and batch catalog
deletions use this implementation.

`packages/database/src/catalog-repository.ts` owns incremental-import-specific
queries: selection usage, modified-plant snapshots, deletion validation/counts,
plant deletion, and the optional photo deletion around the shared photo upsert.

`packages/database/src/catalog-replacement.ts` owns full-replacement-specific
queries: photo-retention discovery, pending-change reconciliation, modified
snapshots, and selection timestamp updates.

## Photos, selections, and property plans

`packages/database/src/plant-photo-queries.ts` owns the plant-photo upsert used
by both catalog and photo repositories. `photo-repository.ts` owns target list,
filename lookup, and deletion.

`packages/database/src/selection-repository.ts` owns selection summaries and
previews, details and status reads, creation/deletion, plant membership changes,
change acknowledgement, and deleted-photo reference checks. Repeated selection
existence and timestamp queries are named constants in that module.

`packages/database/src/property-plan-repository.ts` owns plan summaries and
design hydration, plan existence checks, plan/flowerbed/placement writes,
boundary replacement, and plan deletion. `summaryQuery` is the shared base for
the list and single-plan views.

`packages/database/src/transaction.ts` owns `BEGIN IMMEDIATE`, `COMMIT`, and
`ROLLBACK` transaction control.

## Desktop bootstrap

`apps/desktop/src/main/database.ts` owns startup-only queries: foreign-key
enforcement, schema-presence detection, `user_version`, and legacy selection
column discovery. Migration SQL itself remains in the ordered migration files.

## Dynamic SQL safety

SQLite cannot bind table identifiers, placeholder lists, or pragma values.
These cases are constrained as follows:

- `inClausePlaceholders` generates only comma-separated `?` tokens and rejects
  empty or non-integer counts. All list values are supplied separately to the
  prepared statement.
- Vocabulary identifiers are selected through a closed, typed query map.
- Catalog filter joins and predicates come from fixed application code; only
  filter values are bound at execution.
- `user_version` is validated as a non-negative integer and comes only from the
  migration manifest index before interpolation.

No user-provided SQL fragment or identifier is interpolated by production code.
