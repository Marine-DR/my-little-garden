# My Selections — Unified Screen Proposal

## Screen objective

The **My Selections** screen should allow users to manage their saved flower selections as a reusable object library.

The screen should help users quickly answer the following questions:

1. What selections have I saved?
2. How many flowers does each selection contain?
3. Is this selection still reliable?
4. Have any flowers in the selection been modified or deleted from the catalog?
5. Is this selection used in one or more flowerbed designs?
6. What should I do next: edit, review, replace, duplicate, or delete?

---

## General recommendation

Use a **card view by default**, supported by an optional **table view**.  
The **table view** will be used as MVP.

The card view is better for the main use case because a selection is a visual, reusable object. Users need to recognize a selection quickly, see flower previews, understand its status, and act on it.

The table view should remain available for advanced users, large catalogs, precise sorting, compact scanning, and bulk operations.

Final recommendation:

**Default view: Card view**
**Alternative view: Table view**
**View switcher: `Card view | Table view`**

---

# Overall screen structure

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
```

### Search

Recommended placeholder:

```text
Search selection, flower, flowerbed
```

Search should work across:

* selection names;
* flower names inside a selection;
* flowerbed names using the selection.

### Recommended filters

* **Status**

  * à jour
  * contient des plantes modifiées
  * contient des plantes supprimées

* **Usage**

  * Used in a flowerbed
  * Not used

* **Nombre de fleurs**

* **Date de création**

* **Date de dernière modification**

* **Contient une plante spécifique**

* **Created by me / shared**

  * Add later if collaboration exists.

---

## 3. Administration actions row

This row appears when one or more selections are checked.

```text
┌────────────────────────────────────────────────────────────────────────────────┐
│ 3 sélection selectionnées      [+ Créer une sélection] [Dupliquer] [Supprimer] │
└────────────────────────────────────────────────────────────────────────────────┘
```

Recommended actions:

* **+ Create selection**
* **Duplicate**
* **Delete**

Deletion should be handled carefully if a selection is used in a flowerbed.

The deletion workflow is define in User_workflows.md

# Card view — recommended default

## Why use cards?

Cards make the screen feel more like a **selection library** than a purely administrative list.

They are appropriate because users mainly need to:

* browse selections visually;
* recognize a selection quickly;
* see a preview of the flowers;
* understand whether the selection is healthy or problematic;
* know whether it is used in flowerbeds;
* take the correct action based on its status.

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

* 3 or 4 cards per row
* Recommended width: **340px**
* Recommended height: **265 px**

### Tablet

* 2 cards per row

### Mobile

* 1 card per row

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

* height changed;
* blooming period changed;
* soil requirements changed;
* sun exposure changed;
* persistence changed;
* color changed;
* planting period changed.

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

* scanning many selections;
* comparing exact values;
* sorting by status, usage, number of flowers, or modification date;
* performing bulk actions;
* managing large catalogs.

---

## Recommended table columns

| Column        | Purpose                                        |
| ------------- | ---------------------------------------------- |
| Checkbox      | Bulk actions                                   |
| Nom           | Selection name                                 |
| Apperçu       | Small flower thumbnails or color chips         |
| Plantes       | Number of flowers                              |
| Statut        | Whether the selection is valid or needs review |
| Utilisation   | Whether it is used in flowerbeds               |
| Date Création | Help user to identify oldest selections        |
| Dernière Modification| Helps users understand recency                 |
| Actions       | Rename, Details                                |

---

## Example table content

| ☐ | Nom                  | Apperçu      | Plantes | Statut                | Utilisation           | Date création | Dernière Modification| Actions |
| - | -------------------- | ------------ | ------: | --------------------- | --------------- | ------------- | -----------| ------- |
| ☐ | **Spring Rose Bed**  | 🌸 🌺 🌼 +9  |      12 | ✅ à jour          | 🌿 2 parterres | June 12, 2026 | June 12, 2026 | 🖉 [Detail]|
| ☐ | **Dry Sunny Border** | 🌼 🟡 🟠 +15 |      18 | ⚠️ 3 plantes modifiées | Not used        | June 9, 2026  |June 12, 2026 | 🖉 [Detail]    |
| ☐ | **Wild Corner**      | 🌾 🌸 🔴 +6  |       9 | ❌ 1 plante supprimées  | 🌿 1 parterre  | June 2, 2026  | June 12, 2026 |🖉 [Detail]    |

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

* Rename
* Add plants
* Delete plants

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
|  ☐  | Statut|  Photo | Nom | ↨ (cm) | Type | Sol | Exposition | Floraison | Couleur 🌸 | Couleur 🍃 | ❅ (°C) | Persistant | ↔ (cm) | Plantation |
| --- | -----| ----- | --- | ------ | ---- | --- | ---------- | --------- | ---------- | ---------- | ------ | ---------- | ------ | ---------- |  

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

* **Accept changes**

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
