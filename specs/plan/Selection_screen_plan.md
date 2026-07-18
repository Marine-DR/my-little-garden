# Mes Sélections — MVP Management Screen

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
  - contient des plantes modifiées
  - contient des plantes supprimées

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

Deletion should be handled carefully if a selection is used in a flowerbed.

The deletion workflow is define in User_workflows.md

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

---

## Example card — up-to-date selection

```text
┌────────────────────────────────────────────┐
│ ☐ Spring Rose Bed   [Renommer]             │
│ 12 flowers · Modified on June 12, 2026     │
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
│ 18 flowers · Modified on June 9, 2026      │
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
│ 9 flowers · Modified on June 2, 2026       │
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

---

# Status system

The status is the most important information after the selection name.

It tells the user whether the selection can still be trusted.

## 1. Up to date

Display:

```text
✅ à jour
```

Meaning:

All flowers in the selection still exist in the catalog, and no important data has changed since the selection was last reviewed.

Use green text.

---

## 2. Needs review

Display example:

```text
⚠️ 3 plantes modifiées
```

Meaning:

One or more flowers still exist in the catalog, but their data has changed.

Examples of possible changes:

- height changed;
- blooming period changed;
- soil requirements changed;
- sun exposure changed;
- persistence changed;
- color changed;
- planting period changed.

Clicking the status should open a comparison panel.

Use Warning styling.

---

## 3. Contains error

Display example:

```text
❌ 1 plante supprimée
```

Meaning:

At least one flower in the selection was deleted from the catalog.

This is more severe than a modified flower because the selection can no longer be used cleanly in a flowerbed without review.

Use Error styling.

---

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

Button:

```text
✗
```

### Deleted flowers

```text
❌ 1 flower no longer exists in the catalog
```

Button:

```text
✗
```

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

For deleted plants, show in Statut column:

```text
❌
```

---

# Review changes flow

When a flower has changed, the user needs to understand what changed before accepting or dismissing the warning.

Use a side panel or modal.

## Title

```text
Changes for Echinacea
```

## Comparison table

| Field    | Previous value      | New value                        |
| -------- | ------------------- | -------------------------------- |
| Blooming | June → August       | July → August                    |
| Soil     | light, well-drained | light, well-drained, dry to cool |
| Height   | 80 cm               | 100 cm                           |

## Bottom actions

- **Accept changes**

Recommended default behavior:

Selections should reference the latest catalog flower data, but the user should be able to mark a selection as reviewed after checking the changes.

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

Table will be used as MVP.  
The table should remain available as a secondary compact mode for advanced users, large catalogs, sorting, and bulk operations.

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
