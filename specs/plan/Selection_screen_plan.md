# Mes Sélections — MVP Management Screen

> Sections explicitly labeled MVP remain the historical strict-MVP scope.
> Post-MVP modified/deleted plant status and review behavior follow
> [Catalog_incremental_update_plan.md](Catalog_incremental_update_plan.md).
> The final screen sections also define post-MVP batch selection deletion.
> They define card view and table/card presentation switching for V2.

## Screen objective

The **Mes Sélections** screen lets the user review and update saved plant selections created from the catalog.

For the MVP, the screen must answer:

1. What selections have I saved?
2. How many plants does each selection contain?
3. Which plants are inside a selection?
4. Can I remove plants that no longer belong in this selection?

Selection rename, selection deletion, reliability status, modified/deleted plant review, flowerbed usage, search, filters, and card/table switching are deferred.

## MVP scope

Included:

- create a selection from checked catalog plants;
- add checked catalog plants to one or more existing selections;
- list saved selections in a table;
- open a selection detail screen;
- remove plants from a selection after confirmation.

Excluded from the MVP:

- creating an empty selection from this screen;
- renaming a selection;
- deleting a selection;
- displaying modified/deleted plant reliability status;
- accepting or dismissing catalog changes for a selection;
- showing flowerbed usage or flowerbed impact warnings;
- duplicating selections;
- searching and filtering selections;
- card view and presentation switching.

## Catalog-side creation and add flow

Selections are created from the catalog action bar, not as empty objects from “Mes Sélections”.

When one or more catalog plants are checked, show selection actions below the catalog administration actions:

```text
3 fleurs sélectionnées

[Ajouter à une sélection]
[Créer une sélection]
```

### Create a selection

The create action opens a modal:

```text
Créer une sélection

Nom de la sélection
[________________]

3 fleurs seront ajoutées à cette sélection.

[Annuler] [Créer]
```

Rules:

- the name is mandatory;
- the trimmed display name must be unique by exact text;
- accents and casing remain significant, so `sélection` and `selection` are distinct names;
- at least one catalog plant must be checked;
- selected plants are automatically added to the new selection;
- empty selection creation is rejected.

Success message:

```text
Sélection créée
Massif plein soleil
3 fleurs ajoutées
```

### Add to existing selections

The add action opens a modal:

```text
Ajouter à des sélections

Rechercher une sélection...
[________________]

☐ Massif plein soleil
☐ Prairie fleurie
☐ Bordure terrasse

3 fleurs seront ajoutées aux sélections sélectionnées.

[Annuler] [Ajouter]
```

Rules:

- the user can choose one or more target selections;
- a plant can appear only once in a given selection;
- existing plant-selection links are ignored without producing an error;
- the result reports added associations and ignored duplicates.

Example result:

```text
7 ajouts effectués
2 associations déjà existantes ignorées
```

## Main selections table

Use a table view for the MVP.

Screen structure:

```text
┌──────────────────────────────────────────────────────────────┐
│ MyLittleGarden                 [Mon Catalogue] [Mes Parterres]│
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Mes Sélections                                               │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Selection table                                              │
└──────────────────────────────────────────────────────────────┘
```

Recommended columns:

| Column                | Purpose                            |
| --------------------- | ---------------------------------- |
| Nom                   | Selection name                     |
| Aperçu                | Small plant photos or placeholders |
| Plantes               | Number of current plants           |
| Date création         | Creation date                      |
| Dernière modification | Last selection update date         |
| Actions               | Details                            |

The table shows the current catalog plants linked to each selection. If catalog replacement removes all linked plants, the selection remains visible with `0` plants.

## Table actions

### Open detail

Clicking the details action opens the selection detail screen.

Rename and delete actions are not available in the MVP.

## Selection detail screen

The detail screen displays one selection and its current plants.

Header:

```text
Massif plein soleil
12 plantes
```

Plant table:

| Checkbox | Photo | Nom | Hauteur | Type | Sol | Exposition | Floraison | Couleur fleur | Couleur feuille | Température min | Persistant | Espace | Plantation |
| -------- | ----- | --- | ------- | ---- | --- | ---------- | --------- | ------------- | --------------- | --------------- | ---------- | ------ | ---------- |

Actions:

- remove selected plants from the selection;
- return to the selections table.

### Remove plants

The remove action is available only when one or more plants are checked in the selection detail.

Confirmation:

```text
Retirer 3 plantes de cette sélection ?

Les plantes resteront dans le catalogue.

[Annuler] [Retirer]
```

Rules:

- removing plants deletes only the corresponding `selection_plants` links;
- removing all plants is allowed, and the selection remains visible with `0` plants;
- flowerbed impact warnings are deferred until flowerbed designs exist.

## Empty state

When no selection exists, show:

```text
Aucune sélection enregistrée
```

Supporting text:

```text
Créez une sélection depuis le catalogue en choisissant des plantes.
```

Action:

```text
Retour au catalogue
```

Do not show a “Créer une sélection” button on this screen in the MVP, because empty selections are out of scope.

## Data behavior

After migration `002_remove_selection_normalized_name.sql`, the schema supports the MVP selection identity rules:

- `selections` stores the UUID, display name, and timestamps; selection names are not normalized, but the exact display name is unique;
- `selection_plants` stores the current plant links;
- duplicate plant links are prevented by the composite primary key.

Catalog replacement behavior:

- preserve selection links for plants matched by UUID or normalized name;
- remove links for plants absent from the replacement;
- keep selections that become empty;
- do not persist modified/deleted plant status in the MVP.

In V2, removing a plant link through replacement also removes that plant's placed instances from flowerbeds and creates persistent flowerbed errors. The selection remains present even when it becomes empty. Flowerbed issue behavior follows
[Catalog_incremental_update_plan.md](Catalog_incremental_update_plan.md#67-flowerbed-catalog-impacts).

Post-MVP catalog maintenance adds `selection_plant_changes` without changing
the historical MVP schema:

- Add conflict updates, Modify, Delete, and Replace record affected selections;
- a modified plant retains its state before the first unreviewed material
  change;
- a deleted plant is removed from the live selection, while its UUID, last name, and photo remain in a pending warning;
- status is derived from pending changes rather than stored on `selections`;
- closing or acknowledging a warning clears every change displayed in that warning.

## Validation and tests

Test scenarios:

- create selection from checked catalog plants;
- reject creation with no checked plants;
- reject empty and exact duplicate selection names;
- allow names that differ by accents or casing;
- add checked catalog plants to one or more existing selections;
- ignore duplicate plant-selection links and report them as ignored;
- list selections with current plant counts;
- open a selection detail and display current linked plants;
- remove selected plants from a selection after confirmation;
- verify catalog replacement preserves links for matched plants and removes links for absent plants.

Post-MVP catalog change scenarios are specified in
[Catalog_incremental_update_plan.md](Catalog_incremental_update_plan.md) and
must additionally verify:

- modified, deleted, mixed, and up-to-date derived statuses;
- deleted status priority while still exposing both counts;
- first-old versus latest comparison after repeated modifications;
- automatic removal when a plant returns to its baseline;
- deletion removing the live link while retaining UUID, name, and photo warning data;
- deletion removing placed flowerbed instances and creating persistent flowerbed errors;
- used flower-color deletion removing only affected placed instances;
- impacting name, soil-requirement, spacing, and available-color changes creating flowerbed warnings;
- merging all pending deleted plants;
- close and acknowledgement clearing only the displayed warning kind;
- photo cleanup after the last deleted warning reference is cleared.

Post-MVP selection deletion scenarios must additionally verify:

- Delete is available only after checking selections in the selections list.
- Delete is absent from selection cards and the selection detail.
- Several checked selections are deleted in one atomic transaction.
- Cancelling the confirmation changes no selection or flowerbed.
- Memberships, pending changes, and unreferenced retained photos are cleaned up.
- A flowerbed with zero placed plants is deleted with its source selection.
- A flowerbed with at least one placed plant is detached and permanently locked.
- A locked flowerbed preserves its canvas, buying list, and flowerbed plan.
- View, download, navigation, and flowerbed deletion remain available when
  locked.
- Every edit and unlock attempt is rejected for a locked flowerbed.
- A failure during any deletion effect rolls back the complete batch.

V2 presentation scenarios must additionally verify:

- the first visit uses card view;
- switching to table view displays the same result set;
- switching views preserves search, filters, sorting, current page, page size, and checked selection IDs;
- the last chosen view is restored after closing and reopening the application;
- card and table modes support the same detail and bulk-deletion workflows;
- the Columns action is available only in table view;
- loading, empty, error, and pagination states work in both views;
- card previews handle zero plants, missing photos, and more plants than the preview limit.

# Mes Sélections — Final screen structure

## 1. App header

Use the same structure as the catalog screen.

```text
┌──────────────────────────────────────────────────────────────┐
│ 🌸 My Little Garden           [Mon Catalogue] [Mes Parterres]│
└──────────────────────────────────────────────────────────────┘
```

## 2. Search and filters toolbar

Left side:

```text
Mon Catalogue
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Rechercher une fleur, couleur, sol, exposition...        │ [Filtres(0)]
└─────────────────────────────────────────────────────────────┘
```

Right side:

```text
[Colonnes(0)] [Présentation ▼]
```

Screen name: Main page title style  
Buttons: secondary buttons style

### Presentation switcher

**Présentation** is a secondary button that opens a two-choice menu:

```text
Présentation

● Cartes
○ Tableau
```

Behavior:

- **Cartes** is the default when no preference has been stored.
- Choosing an option updates the results area immediately and closes the menu.
- Store the last choice locally as `cards` or `table`; this is interface preference, not selection domain data.
- Restore the stored choice when **Mes Sélections** is opened again, including after an application restart.
- Keep the same query and UI state when switching: search, filters, sorting, page number, page size, and checked selection IDs.
- Do not refetch unrelated detail data merely because presentation changes.
- Keep **Colonnes** visible and enabled only in table mode. Hide it in card mode.
- Expose the current choice through `aria-pressed`, `aria-checked`, or equivalent accessible menu semantics.
- Support keyboard opening, arrow navigation, selection, Escape, and focus return to the **Présentation** button.

Both modes use the same paginated `SelectionSummary` result. Presentation switching must not change result ordering, total count, or page boundaries.

For each visible selection, the summary contract supplies:

- selection ID and name;
- current plant count;
- up to three preview plants with ID, name, and resolved photo URL;
- creation and last-modification dates;
- derived status plus modified-plant and deleted-plant counts;
- flowerbed usage count and the names required by the usage popover.

Choose preview plants deterministically by `selection_plants.added_at`, then plant ID as the tie-breaker. Return only the preview subset in the summary; do not load the complete plant collection for every card. No database migration is required solely for presentation switching.

### Search

Recommended placeholder:

```text
Search selection, flower, flowerbed
```

Search should work across:

- selection names;
- flower names inside a selection;
- flowerbed names using the selection.

### Recommended filters

- **Status**

  - à jour
  - X plantes modifiées
  - X plantes supprimées

- **Usage**

  - Used in a flowerbed
  - Not used

- **Nombre de fleurs**

- **Date de création**

- **Date de dernière modification**

- **Contient une plante spécifique**

- **Created by me / shared**

  - Add later if collaboration exists.

---

## 3. Administration actions row

This row appears when one or more selections are checked.

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│ 3 sélection selectionnées      [+ Créer une sélection] [Dupliquer] [Supprimer] │
└────────────────────────────────────────────────────────────────────────────────┘
```

Recommended actions:

- **+ Create selection**
- **Duplicate**
- **Delete**

Delete is available only in this administration row on the selections list.
It is not available in the selection detail screen or as an individual card action.

### Delete checked selections

The action deletes every checked selection in one atomic operation.

Before confirmation, classify every flowerbed sourced from those selections:

- **Delete flowerbed** when its buying list is empty, meaning it contains zero placed plant instances.
- **Permanently lock flowerbed** when its buying list is not empty, meaning the user placed at least one plant.

The confirmation dialog lists:

- every checked selection name;
- every empty flowerbed that will be deleted, grouped by selection;
- every non-empty flowerbed that will be permanently locked, grouped by selection;
- totals for selections, deleted flowerbeds, and locked flowerbeds.

Example:

```text
Supprimer 3 sélections ?

Les sélections et leurs données associées seront supprimées définitivement.

2 parterres vides seront supprimés.
1 parterre contenant des plantes sera verrouillé définitivement.

Parterres supprimés
- Bordure vide
- Essai terrasse

Parterres verrouillés
- Entrée principale

[Annuler] [Supprimer]
```

Confirmation rules:

- use the destructive confirmation style;
- disable confirmation while the impact preview is loading;
- cancelling changes nothing;
- a failure rolls back the complete batch;
- after success, clear checked rows and show deleted-selection,
  deleted-flowerbed, and locked-flowerbed counts.

Deletion effects:

- delete each selected `selections` row;
- cascade its `selection_plants` and pending `selection_plant_changes` rows;
- clean up retained managed photos that no live plant or remaining pending warning references;
- delete affected flowerbeds whose buying list is empty;
- retain affected flowerbeds whose buying list is not empty, sever their source selection association, and persist an irreversible
  `source_selection_deleted` lock;
- preserve the locked flowerbed canvas, buying list, and flowerbed plan;
- allow the user to view, download, or delete a locked flowerbed;
- reject all edits to a locked flowerbed.

# Card view — recommended default

## Why use cards?

Cards make the screen feel more like a **selection library** than a purely administrative list.

They are appropriate because users mainly need to:

- browse selections visually;
- recognize a selection quickly;
- see a preview of the flowers;
- understand whether the selection is healthy or problematic;
- know whether it is used in flowerbeds;
- take the correct action based on its status.

Cards are less efficient than tables for scanning exact values, but they are better for visual recognition and immediate understanding.

---

## Card anatomy

Each card represents **one selection**.

A card should contain:

1. **Selection name**
2. **Checkbox**
3. **Overflow menu**
4. **Metadata**
5. **Flower preview strip**
6. **Status**
7. **Usage**
8. **Primary and secondary actions**

Required card behavior:

- place the checkbox at the top-left and keep it independent from the details action;
- checking a card participates in the same bulk-selection state as table-row checkboxes;
- show the selection name without truncation when it fits and use an accessible tooltip when it is ellipsized;
- show current plant count and last modification date;
- show up to three current plant photos, using the catalog photo placeholder when a plant has no photo;
- show `+N` when more than three current plants exist;
- show the standard empty preview when the selection contains zero plants;
- display the derived status and both underlying counts according to the status rules below;
- display flowerbed usage using the same data and interaction as table view;
- open the detail screen only through **Détails** or an explicitly accessible equivalent, so clicking the checkbox or overflow menu never navigates;
- keep selection deletion out of the card menu because deletion is a checked bulk action from the administration row.

---

## Example card — up-to-date selection

```text
┌────────────────────────────────────────────┐
│ ☐ Spring Rose Bed   [Renommer]             │
│ 12 flowers ·                               │
│                                            │
│ [🌸] [🌺] [🌼] [+9]                        │
│                                            │
│ ✅ Up to date                              │
│ 🌿 Used in 2 flowerbeds                    │
│                                            │
│  [View details]                            │
└────────────────────────────────────────────┘
```

---

## Example card — modified flowers

```text
┌────────────────────────────────────────────┐
│ ☐ Dry Sunny Border   [Renommer]            │
│ 18 flowers ·                               │
│                                            │
│ [🌼] [🟡] [🟠] [+15]                       │
│                                            │
│ ⚠️ 3 flowers modified                      │
│ Not used                                   │
│                                            │
│ [View details]                             │
└────────────────────────────────────────────┘
```

---

## Example card — deleted flower

```text
┌────────────────────────────────────────────┐
│ ☐ Wild Corner   [Renommer]                 │
│ 9 flowers ·                                │
│                                            │
│ [🌾] [🌸] [🔴] [+6]                        │
│                                            │
│ ❌ 1 flower deleted                        │
│ 🌿 Used in 1 flowerbed                     │
│                                            │
│ [View details]                             │
└────────────────────────────────────────────┘
```

---

## Card grid

Use a responsive grid.

### Desktop

- 3 or 4 cards per row
- Recommended width: **340px**
- Recommended height: **265 px**

### Tablet

- 2 cards per row

### Mobile

- 1 card per row

Use CSS grid with `minmax(300px, 340px)`-equivalent sizing and consistent gaps.
Cards in the same row may stretch to the same height, but content must not be clipped. The results footer and pagination remain below the complete grid.

Card mode uses the same 25/50/100 page-size choices as table mode. Changing the page size returns to page 1; switching presentation does not.

---

# Status system

The status is the most important information after the selection name.

It tells the user whether catalog changes still need to be reviewed. Status is
derived from pending selection plant changes.

Every selection has exactly one displayed status:

| Status                   | Display condition                                               |
| ------------------------ | --------------------------------------------------------------- |
| Contains deleted plants  | At least one pending deletion exists                            |
| Contains modified plants | No deletion exists and at least one pending modification exists |
| Up to date               | No pending modified or deleted plant warning remains            |

This order is also the priority: a selection that contains both deleted and modified plants displays **Contains deleted plants**.

The selections list exposes modified and deleted counts even when deleted
plants determine the displayed status.

## 1. Up to date

Display:

```text
✅ à jour
```

Meaning:

No pending modified or deleted plant warning remains for the selection.

Use green text.

---

## 2. Contains modified plants

Display example:

```text
⚠️ 3 plantes modifiées
```

Meaning:

One or more live plants have materially changed since their first unreviewed change.

Examples of possible changes:

- name changed;
- height changed;
- type or Fleur/autre changed;
- blooming period changed;
- soil requirements changed;
- sun exposure changed;
- persistence changed;
- flower or leaf color changed;
- minimum temperature or spacing changed;
- planting period changed.

Clicking the status opens one comparison panel containing every pending modified plant. Each comparison uses the state before the first unreviewed change and the latest live catalog state. Repeated modifications count the plant once. Returning exactly to the baseline removes the warning.

Use Warning styling.

---

## 3. Contains deleted plants

Display example:

```text
❌ 1 plante supprimée
```

Meaning:

At least one plant was removed from the catalog and from the live selection, but its one-time warning has not yet been cleared.

All pending deleted plants are merged into one warning. It contains only each deleted plant UUID, last name, and retained photo. No deleted plant appears in the live plant table.

Use Error styling.

---

## Status transitions after review

- Clearing deleted-plant warnings changes the status to **Contains modified plants** when modification warnings remain.
- Clearing modified-plant warnings leaves **Contains deleted plants** when deletion warnings remain.
- Clearing the final pending warning changes the status to **Up to date**.
- Closing one review panel clears only the changes displayed by that panel and never clears the other warning kind.

# Usage indicator

Selections can be used in flowerbed designs, so the UI must clearly show whether a selection is currently used.

## Not used

Display:

```text
Not used
```

Use secondary text styling.

Deletion is allowed.

## Used

Display:

```text
🌿 Used in 2 flowerbeds
```

Clicking this indicator should open a small popover or side panel.

Example:

```text
Used in:

- Front Entrance Bed
- North Garden
```

---

# Card actions

Rename the selection:

```text
🖉
```

See details action:

```text
View details
```

Deletion is intentionally absent from card actions. The user must check one or more selections and use the administration-row Delete action.

---

# Suggested card layout

```text
┌──────────────────────────────────────────────────────────────┐
│ 🌸 My Little Garden           [Mon Catalogue] [Mes Parterres]│
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ Mes Sélections                                               |
| 🔍 Rechercher une fleur ...    [Filtrer]                     │
└──────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ [Télécharger ▼]                                              │
└──────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────┐
│ 3 sélection selectionnées      [+ Créer une sélection] [Dupliquer] [Supprimer] │
└────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│ Spring Rose Bed   │ │ Dry Sunny Border  │ │ Wild Corner       │
│ 12 plantes        │ │ 18 plantes        │ │ 9 plantes         │
│ 🌸 🌺 🌼 +9       │ │ 🌼 🟠 🟡 +15      │ │ 🌾 🌸 +6          │
│ ✅ à jour         │ │ ⚠️ 3 modifiées    │ │ ❌ 1 supprimée    │
│ 🌿 2 parterres    │ │ Not used          │ │ 🌿 1 parterre     │
│ [Détails]         │ │ [Détails]         │ │ [Détails]         │
└───────────────────┘ └───────────────────┘ └───────────────────┘
```

---

# Table view — secondary mode

The table view should be available for users who need a more compact and precise view.

It is useful for:

- scanning many selections;
- comparing exact values;
- sorting by status, usage, number of flowers, or modification date;
- performing bulk actions;
- managing large catalogs.

Table rows and cards are two renderings of the same `SelectionSummary`. A selection checked in one mode remains checked in the other. Sorting, filtering, pagination, status, usage, dates, preview photos, and actions must have equivalent meaning in both modes.

---

## Recommended table columns

| Column                | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| Checkbox              | Bulk actions                                   |
| Nom                   | Selection name                                 |
| Apperçu               | Small flower thumbnails or color chips         |
| Plantes               | Number of flowers                              |
| Statut                | Whether the selection is valid or needs review |
| Utilisation           | Whether it is used in flowerbeds               |
| Date Création         | Help user to identify oldest selections        |
| Dernière Modification | Helps users understand recency                 |
| Actions               | Rename, Details                                |

---

## Example table content

| ☐   | Nom                  | Apperçu      | Plantes | Statut                 | Utilisation    | Date création | Dernière Modification | Actions    |
| --- | -------------------- | ------------ | ------: | ---------------------- | -------------- | ------------- | --------------------- | ---------- |
| ☐   | **Spring Rose Bed**  | 🌸 🌺 🌼 +9  |      12 | ✅ à jour              | 🌿 2 parterres | June 12, 2026 | June 12, 2026         | 🖉 [Detail] |
| ☐   | **Dry Sunny Border** | 🌼 🟡 🟠 +15 |      18 | ⚠️ 3 plantes modifiées | Not used       | June 9, 2026  | June 12, 2026         | 🖉 [Detail] |
| ☐   | **Wild Corner**      | 🌾 🌸 🔴 +6  |       9 | ❌ 1 plante supprimées | 🌿 1 parterre  | June 2, 2026  | June 12, 2026         | 🖉 [Detail] |

---

## Suggested table layout

```text
┌──────────────────────────────────────────────────────────────┐
│ 🌸 My Little Garden           [Mon Catalogue] [Mes Parterres]│
└──────────────────────────────────────────────────────────────┘
┌───────────────────────────────────────────────────────────────────────────────┐
│ Mes Sélections                                                                |
| 🔍 Rechercher une fleur ...    [Filtrer]          [Colonnes] [Présentation ▼] │
└───────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────┐
│ [Télécharger ▼]                                              │
└──────────────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────────────────────────────────┐
│ 3 sélection selectionnées      [+ Créer une sélection] [Dupliquer] [Supprimer] │
└────────────────────────────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────┐
│ Selection Grid                                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ 1-25 sur 400 fleurs             Pagination                             [25▼] │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# Selection detail / edit view

When the user clicks on **Detail** ina a card or in the table row, open a dedicated detail screen.

## Header

Example:

```text
Spring Rose Bed
```

Actions:

- Rename
- Add plants
- Delete plants

There is no selection Delete action in the detail view. **Delete plants** removes checked plant memberships from this selection; it does not delete the selection or catalog plants.

Metadata:

```text
12 plants · Used in 2 flowerbeds · Last reviewed: June 12, 2026
```

---

## Warning block

Only show this section when needed.

### Modified flowers

```text
⚠️ 3 flowers have been modified in the catalog
```

Action:

```text
[Details]
```

Opening the action displays one comparison panel for all pending modified plants.

### Deleted flowers

```text
❌ 1 flower no longer exists in the catalog
```

Action:

```text
[Details]
```

The merged warning lists the retained identity:

```text
[Photo] Achillée
UUID: 1438d2d2-…
```

All pending deletions are displayed together, even when they came from different catalog operations.

---

## Flowers inside the selection

Inside the detail view, display the flowers in a table.

| ☐   | Statut | Photo | Nom | ↨ (cm) | Type | Sol | Exposition | Floraison | Couleur 🌸 | Couleur 🍃 | ❅ (°C) | Persistant | ↔ (cm) | Plantation |
| --- | ------ | ----- | --- | ------ | ---- | --- | ---------- | --------- | ---------- | ---------- | ------ | ---------- | ------ | ---------- |

For up to date plants, show in Statut column:

```text
✅
```

For changed plants, show in Statut column:

```text
⚠️
```

Deleted plants do not appear in this table. They appear only in the deleted plants warning above it.

---

# Review changes flow

When plants have changed, the user needs to understand what changed before clearing the warning.

Use one side panel or modal containing every pending modified plant.

## Title

```text
Modifications du catalogue
```

## Comparison table

```text
Echinacea
```

| Field    | Previous value      | Current value                    |
| -------- | ------------------- | -------------------------------- |
| Blooming | June → August       | July → August                    |
| Soil     | light, well-drained | light, well-drained, dry to cool |
| Height   | 80 cm               | 100 cm                           |

Omit fields that did not change. Repeat the plant heading and comparison table
for every pending modified plant.

## Bottom actions

- **Acknowledge changes**
- close control

Both actions clear every modified change currently displayed. Closing is an acknowledgement, not a “review later” action. Current live values become the implicit new baseline.

The deleted-plants warning follows the same clearing rule: its acknowledgement action or close control clears every displayed deleted change. Clearing one warning kind does not clear the other. The selection status is recalculated after each clear.

---

# Empty state

When the user has no saved selections, show a centered card inside the main content area.

```text
Pas de sélection existante
```

Supporting text:

```text
Créer une sélection depuis le catalogue en choisissant des fleurs ou créer une sélection vide depuis cet écran.
```

Buttons:

```text
+ Créer une sélection
Retour au catalogue
```

---

# Final recommendation

For **Mes Sélections**, use **cards by default** because a selection is a curated group of flowers. It benefits from a visual, object-based layout.

The card should make the most important questions immediately visible:

```text
Is this selection healthy?
Is it used somewhere?
What should I do next?
```

The historical strict MVP used only the table. V2 defaults to cards and keeps the table available through **Présentation** as a compact mode for advanced users, large catalogs, sorting, and bulk operations.

The most important information to prioritize is:

1. **Selection name**
2. **Status**
3. **Usage**
4. **Flower preview**
5. **Next action**

The user’s main risk is not simply how many flowers are inside the selection. The real risk is:

```text
Can I still trust this selection?
Will changing or deleting it affect a flowerbed?
```

Therefore, the UI should make **Status** and **Usage** the two most visible pieces of information after the selection name.
