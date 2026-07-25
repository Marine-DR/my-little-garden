# Incremental Catalog Maintenance

## 1. Purpose and authority

This document is the authoritative post-MVP specification for maintaining the
plant catalog without replacing it.

It adds four catalog-management capabilities:

- add a batch of plants from CSV;
- modify a batch of plants from CSV;
- delete checked plants from the catalog after confirmation;
- export the current catalog with stable plant identifiers.

The existing full-catalog replacement remains available. Add, modify, delete,
and replacement all use the same plant identity rules and selection-change
tracking rules.

This plan does not add an individual plant creation or editing form. Photos
remain managed through the separate photo-import workflow.

## 2. Catalog management actions

The **Gérer le catalogue** menu contains:

```text
Gérer le catalogue

Ajouter des plantes depuis un CSV
Modifier des plantes depuis un CSV
Remplacer tout le catalogue
Télécharger le catalogue actuel
```

The blank catalog template remains available from the Help menu.

Deletion is not a CSV operation. It is available in the checked-plant action
row beside the selection actions:

```text
3 plantes sélectionnées

[Ajouter à une sélection] [Créer une sélection] [Supprimer]
```

The delete button uses the global delete-button style and is disabled when no
plant is checked.

## 3. CSV formats

### 3.1 Supported headers

The importer accepts both formats:

1. The legacy 15-column format beginning with `Nom`.
2. The 16-column format beginning with the optional `plant_id` column,
   followed by the same 15 horticultural columns.

The new exported header is:

```text
plant_id,Nom,Taille min,Taille Max,Type,Fleur/autre,Sol,Exposition,Floraison début,Floraison fin,Couleurs fleurs,Couleurs feuilles,T° min (°C),Feuillage persistant,Espace(cm),Plantation
```

Existing CSV files without `plant_id` remain valid.

### 3.2 Complete-record semantics

Each CSV row represents the complete desired plant record:

- blank optional cells clear the corresponding existing values;
- `Nom`, at least one `Sol`, and at least one `Exposition` remain mandatory;
- missing mandatory values are blocking validation errors;
- multi-value cells continue to use `|`;
- all existing enumeration, range, normalization, and duplicate rules remain
  applicable.

CSV add and modify operations do not import photos:

- modifying a plant preserves its current managed photo;
- creating a plant creates it without a photo;
- photos can then be added or changed through the existing photo-import
  workflow.

### 3.3 Plant identity

Rows are matched in this order:

1. When `plant_id` is present, it is authoritative and is matched first.
2. When `plant_id` is absent, match by normalized plant name.
3. Generate a UUID only when a row is committed as a new plant and has no
   supplied UUID.

The normalized-name rules remain trim, whitespace collapse, accent removal,
and case folding.

Renaming an existing plant through CSV is reliable only when the row contains
its existing `plant_id`.

The following are blocking identity errors:

- an invalid UUID;
- duplicate UUIDs or normalized names inside the uploaded file;
- a UUID that identifies one plant while the normalized name identifies a
  different plant;
- a new or renamed plant whose normalized name conflicts with another catalog
  plant.

A supplied, valid, unknown UUID is retained when its row is committed as a new
plant.

### 3.4 Current-catalog export

**Télécharger le catalogue actuel** exports every current plant with
`plant_id` as its first column.

The export:

- uses the same horticultural headings and values accepted by the importer;
- contains one complete row per plant;
- preserves stable UUIDs so users can modify or rename plants safely;
- excludes managed-photo metadata because photos use a separate workflow;
- is UTF-8 and follows the existing CSV separator and escaping conventions.

The export must be accepted without data loss by both Modify and Replace.

## 4. Add and modify workflow

### 4.1 Shared steps

Both actions follow the same five steps:

1. Select a CSV file.
2. Parse and validate the whole file.
3. Display a preview.
4. Resolve the mode-specific conflict group and confirm.
5. Commit atomically and display feedback.

The preview is mandatory even when the file has no conflicts.

It displays counts and row details for:

- plants to create;
- plants to modify;
- unchanged plants;
- mode-specific conflicts;
- ignored plants after a conflict choice;
- new vocabulary values;
- warnings;
- blocking errors.

Blocking errors disable confirmation. The error view lists all actionable
errors found during validation.

### 4.2 Add mode

Rows that do not match a catalog plant are ready to create.

Rows that match an existing plant form one conflict group. Before confirmation,
the user must choose one policy for the complete group:

- **Mettre à jour les plantes existantes**: apply every conflicting row
  as a complete-record modification.
- **Ignorer toutes les plantes existantes**: leave every matching catalog plant
  unchanged.

The choice does not affect non-conflicting new rows.

### 4.3 Modify mode

Rows that match an existing catalog plant are ready to modify.

Rows that do not match an existing plant form one conflict group. Before
confirmation, the user must choose one policy for the complete group:

- **Créer toutes les plantes absentes**: create every missing row.
- **Ignorer toutes les plantes absentes**: do not add any missing row.

The choice does not affect rows that match existing plants.

### 4.4 Unchanged plants

Compare the complete material plant record, excluding technical timestamps.

When the imported row produces no material change:

- do not rewrite `updated_at`;
- count the row as unchanged;
- do not create a selection-change warning.

Material fields are name, height, type, plant kind, soils, exposures, flowering
period, flower colors, leaf colors, minimum temperature, foliage persistence,
spacing, and planting seasons.

### 4.5 Preview token and commit safety

A valid preview returns an opaque, short-lived preview token owned by the
Electron main process. The renderer never submits transformed plant records
for persistence.

Commit receives the preview token and the selected conflict policy. Before
writing, it re-evaluates identities and conflicts against the current
database. If the catalog changed after preview in a way that changes the
result, commit fails and requires a new preview.

The commit transaction includes:

- plant scalar fields;
- plant relationships;
- newly introduced vocabulary values;
- selection modification records.

Any failure rolls back the complete operation.

## 5. Delete checked plants

### 5.1 Preview and confirmation

Clicking **Supprimer** first loads a deletion preview for the checked plant IDs.

The confirmation dialog shows:

- the number and names of plants to delete;
- every affected selection;
- the affected plant names grouped under each selection.

Example:

```text
Supprimer 3 plantes du catalogue ?

Achillée
Cosmos
Pavot

Sélections concernées

Massif plein soleil
- Achillée
- Cosmos

Prairie fleurie
- Cosmos
- Pavot

[Annuler] [Supprimer]
```

Cancel closes the dialog and performs no mutation.

### 5.2 Commit behavior

Confirmation performs one database transaction:

1. Revalidate that the requested plants still exist.
2. Record one pending deleted-plant change for every affected
   selection/plant pair.
3. Remove the live `selection_plants` links through plant deletion.
4. Delete the selected plants and dependent catalog relationships.

Deleted plants no longer appear in the live selection plant table.

After commit:

- refresh the catalog and filter options;
- return to the first valid page if deletion emptied the current page;
- clear checked plant IDs;
- display success feedback.

### 5.3 Deleted photo lifetime

Pending deletion warnings retain the deleted plant UUID, last display name, and
managed photo filename.

The managed image file remains available while at least one pending selection
change references it. After a warning is cleared, remove the file only when:

- no live `plant_photos` row references it; and
- no other pending selection change references it.

Database commit occurs before physical cleanup. A cleanup failure is reported
without restoring already committed catalog data and can be retried safely.

## 6. Selection-change tracking

### 6.1 Planned migration

Add a versioned migration containing a pending-change table equivalent to:

```sql
CREATE TABLE selection_plant_changes (
    id                     TEXT PRIMARY KEY,
    selection_id           TEXT NOT NULL,
    plant_id               TEXT NOT NULL,
    change_kind            TEXT NOT NULL CHECK (
        change_kind IN ('modified', 'deleted')
    ),
    plant_name             TEXT NOT NULL,
    photo_managed_filename TEXT,
    baseline_version       INTEGER,
    baseline_json          TEXT,
    created_at             TEXT NOT NULL,
    updated_at             TEXT NOT NULL,
    CONSTRAINT uq_selection_plant_changes
        UNIQUE (selection_id, plant_id),
    FOREIGN KEY (selection_id) REFERENCES selections (id) ON DELETE CASCADE,
    CONSTRAINT ck_selection_plant_change_baseline CHECK (
        (
            change_kind = 'modified'
            AND baseline_version IS NOT NULL
            AND baseline_json IS NOT NULL
        )
        OR (
            change_kind = 'deleted'
            AND baseline_version IS NULL
            AND baseline_json IS NULL
        )
    )
);

CREATE INDEX idx_selection_plant_changes_selection_kind
    ON selection_plant_changes (selection_id, change_kind);

CREATE INDEX idx_selection_plant_changes_photo
    ON selection_plant_changes (photo_managed_filename);
```

`plant_id` deliberately has no foreign key to `plants`, because deleted-plant
warnings must survive deletion of the live plant.

`baseline_json` is a versioned serialization of the complete material plant
record before its first unreviewed change. The core package owns its shape and
comparison rules.

### 6.2 Modified plants

When a material plant change affects a selection:

- create a `modified` record containing the state before the first unreviewed
  modification;
- do not replace that baseline on later modifications;
- compare the retained baseline with the latest live plant when displaying the
  warning;
- count a plant only once per selection.

If later changes return the plant exactly to its retained baseline, remove the
pending modification record.

### 6.3 Deleted plants

Before deleting a selected plant:

- replace any pending `modified` record for that selection/plant with a
  `deleted` record;
- retain only its UUID, last display name, and managed photo filename;
- remove its live selection link as part of plant deletion.

All pending deleted plants for a selection are displayed in one merged warning,
regardless of how many delete operations created them.

### 6.4 Catalog replacement

Full-catalog replacement uses the same matching and warning rules:

- preserve stable UUIDs for matched plants;
- create modification records for materially changed matched plants;
- create deletion records before removing plants absent from the replacement;
- preserve selection links for matched plants;
- remove live links for deleted plants.

### 6.5 Derived selection status

Status is derived from pending changes rather than stored on `selections`.

The domain exposes exactly one of these three values:

| Domain value               | French label                                                   | Derivation rule                                                 |
| -------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| `contains_deleted_plants`  | **[Number of deleted plants] plantes supprimées**              | At least one pending deletion exists                            |
| `contains_modified_plants` | **[Number of modified plants] Contient des plantes modifiées** | No deletion exists and at least one pending modification exists |
| `up_to_date`               | **À jour**                                                     | No pending modification or deletion exists                      |

The order in the table is the display priority. A selection with both pending
change kinds therefore has `contains_deleted_plants` status.

Selection summaries expose both modified and deleted counts even when deletion
has display priority.

The status is recalculated after every catalog mutation and every
acknowledgement:

| Event                                                       | Resulting status           |
| ----------------------------------------------------------- | -------------------------- |
| First material modification                                 | `contains_modified_plants` |
| Any deletion while either no warning or modifications exist | `contains_deleted_plants`  |
| Clear deletions while modifications remain                  | `contains_modified_plants` |
| Clear modifications while deletions remain                  | `contains_deleted_plants`  |
| Clear the last pending warning                              | `up_to_date`               |

### 6.6 Review and clearing

The selection detail contains two independent panels when required:

- one comparison panel showing all pending modified plants;
- one merged warning showing all pending deleted plants.

The modification panel compares each baseline field with the current live
value. Unchanged fields may be omitted.

Closing a panel with its close control or pressing its acknowledgement action
clears every change currently displayed in that panel:

- clearing modified changes makes current live values the implicit new
  baseline;
- clearing deleted changes removes their retained names, UUIDs, and photo
  references;
- clearing one change kind does not clear the other.

Photo cleanup runs after clearing deleted warnings according to section 5.3.

## 7. Service contracts

The precise TypeScript names may follow repository naming conventions, but the
typed contracts must provide these behaviors.

### 7.1 Catalog import

```ts
type CatalogMutationMode = 'add' | 'modify';

type AddConflictPolicy = 'update_existing' | 'ignore_existing';
type ModifyConflictPolicy = 'create_missing' | 'ignore_missing';

previewCatalogMutation(
  mode: CatalogMutationMode,
  filename: string,
  csv: string,
): Promise<CatalogMutationPreview>;

commitCatalogMutation(
  previewId: string,
  conflictPolicy: AddConflictPolicy | ModifyConflictPolicy,
): Promise<CatalogMutationResult>;
```

The preview DTO contains row details and counts for create, modify, unchanged,
conflict, warning, error, and new-vocabulary categories.

The result DTO contains created, modified, ignored, and unchanged counts.

### 7.2 Export

```ts
exportCurrentCatalog(): Promise<string>;
```

### 7.3 Deletion

```ts
previewPlantDeletion(
  plantIds: readonly string[],
): Promise<PlantDeletionPreview>;

deletePlants(
  plantIds: readonly string[],
): Promise<PlantDeletionResult>;
```

The preview maps affected selection IDs and names to plant IDs and names. The
result reports deleted plant and affected selection counts.

### 7.4 Selection changes

Selection summaries add:

- derived status;
- modified plant count;
- deleted plant count.

Selection details add:

- modified plant comparisons;
- deleted plant UUID, name, and photo URL records.

The selection service provides separate acknowledgement actions for all
currently displayed modified changes and all currently displayed deleted
changes.

## 8. Package responsibilities

- `packages/core` owns mutation modes, conflict policies, identity rules,
  material comparison, baseline snapshot shape, status derivation, and ports.
- `packages/communication` parses both CSV formats and exports the
  current-catalog format.
- `packages/database` implements atomic catalog mutations, impact queries,
  pending change persistence, and acknowledgement.
- Electron main owns preview-token lifetime, operation orchestration, and
  post-commit photo-file cleanup.
- `apps/desktop/src/shared` owns service-scoped IPC contracts.
- Preload exposes one safe method per operation.
- Renderer displays previews, confirmations, status, comparisons, warnings,
  feedback, and errors without direct filesystem or database access.

## 9. Feedback

Use the existing success-banner and error-modal patterns.

Success examples:

```text
Ajout terminé : X plantes ajoutées, Y mises à jour, Z ignorées.
Modification terminée : X plantes modifiées, Y créées, Z ignorées, W inchangées.
Suppression terminée : X plantes supprimées. Y sélections ont été mises à jour.
```

Use correct French singular and plural forms. When a count is zero it may be
omitted from the sentence, but the operation must always produce visible
feedback.

Validation and transaction failures display all actionable errors and leave
catalog data unchanged.

## 10. Acceptance criteria

- Add a CSV containing only new plants.
- In Add mode, update all or ignore all existing conflicts.
- Modify existing plants from a full-record CSV.
- In Modify mode, create all or ignore all missing conflicts.
- Rename a plant by stable UUID.
- Reject UUID/name identity conflicts and duplicate file identities.
- Accept legacy CSV files without `plant_id`.
- Export and re-import the current catalog without changing UUIDs or data.
- Reject the complete import when any non-conflict row is invalid.
- Preserve managed photos during CSV modification.
- Leave identical plants unchanged without warnings.
- Record only material changes affecting selections.
- Preserve the first old value through repeated unreviewed modifications.
- Remove a warning when a plant returns to its baseline.
- Preview affected selections before deletion.
- Cancel deletion without changing catalog or selections.
- Delete checked plants and remove their live selection links.
- Merge all pending deleted plants into one selection warning.
- Retain deleted photos until their last warning is cleared.
- Derive deleted status above modified status.
- Clear only the displayed warning kind on close or acknowledgement.
- Apply the same selection tracking during full-catalog replacement.
- Roll back plant, relationship, vocabulary, and change-record writes together
  when commit fails.
