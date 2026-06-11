
# MyLittleGarden – Flower Catalog Management

## Complete UX/UI Product Specification

**Version:** 3.1
**Date:** 11/06/2026

---

# Overview

The Flower Catalog is the administrative module used to manage flowers available in MyLittleGarden.

Users can:

* Search, sort and filter flowers
* Create, edit and delete flowers
* Import flowers through CSV
* Import flower images
* Create flower lists from selections
* Add flowers to existing lists
* Manage catalog data used later in the Dessiner module

A flower may belong to multiple lists.

---

# Header

Application title:

```text
🌿 MyLittleGarden
```

Navigation:

```text
[Mes listes]   [Dessiner]
```

Buttons:

* **Dessiner** → Primary filled green button
* **Mes listes** → Secondary outlined button

---

# Toolbar

```text
┌─────────────────────────────────────────────────────────────┐
│ 🔍 Rechercher une fleur, couleur, sol, exposition...       │
└─────────────────────────────────────────────────────────────┘
```

Right side:

```text
[Filtres] [Colonnes]
```

---

# Active Filters

Displayed as removable chips.

Example:

```text
☀ Soleil ✕
Vivace ✕
Floraison Été ✕
```

---

# Administration Actions

Displayed above the flower grid.

```text
[+ Ajouter une fleur]
[📄 Import CSV ▼]
[🖼 Import Images ▼]
```

---

# Flower Creation

Click:

```text
+ Ajouter une fleur
```

Opens a right-side drawer.

## Drawer Layout

```text
Nouvelle fleur
────────────────────────

Photo
[Ajouter une image]

Nom
[________________]

Hauteur
[50] à [80] cm

Type
[Vivace ▼]

Fleur / autre
[Fleur ▼]

Sol
☑ Léger
☑ Drainé
☐ Humide
☐ Argileux

Exposition
☑ Soleil
☑ Mi-ombre
☐ Ombre

Température minimale
[-10] °C

Floraison
[Juin ▼] → [Septembre ▼]

Couleurs fleurs
⚪ 🟡 🔴 🟣 🔵 🩷 🟠

Couleurs feuilles
🟢 🟡 🟤

Persistant
○ Oui
○ Non
○ Semi-persistant

Espacement
[40] à [60] cm

Plantation
☑ Printemps
☑ Automne

[Annuler] [Enregistrer]
```

---

# Flower Editing

Each row contains:

```text
✏️ Modifier
```

Editing opens the same drawer prefilled with existing data.

```text
Modifier la fleur
```

Only one flower may be edited at a time.

---

# Flower Deletion

## Single Flower

```text
🗑 Supprimer
```

Confirmation modal:

```text
Supprimer Achillée ?

Cette action est définitive.

[Annuler] [Supprimer]
```

Delete action is red.

---

# CSV Import

Dropdown:

```text
📄 Import CSV
────────────────────────
➕ Ajouter des fleurs
✏️ Mettre à jour des fleurs
➖ Supprimer des fleurs
🔄 Remplacer tout le catalogue
────────────
📥 Télécharger modèle CSV
```

### Import Workflow

```text
1. Upload du fichier
2. Prévisualisation
3. Validation
4. Confirmation
5. Résultat
```

Validation example:

```text
125 lignes détectées

✓ 120 lignes valides
⚠ 3 avertissements
❌ 2 erreurs
```

Matching rule:

```text
Nom
```

Future fallback:

```text
Nom + Type
```

Backend manages `flower_id`.

---

## Image Import

Dedicated button:

```text
🖼 Import Images
```

Dropdown:

```text
Importer une image
Importer plusieurs images (.zip)
Télécharger modèle de nommage
```

Accepted formats:

```text
.jpg
.jpeg
.png
.webp
.zip
```

Matching rule:

```text
Nom du fichier = Nom de la fleur
```

Example:

```text
Achilée Ornementale.jpg
```

Result:

```text
15 images détectées

✓ 13 fleurs reconnues
⚠ 2 images sans correspondance
```

---

# Flower Lists Management

## Purpose

Lists are named collections of flowers.

Lists are used later in the Dessiner module to build flowerbeds.

Rules:

* One flower may belong to multiple lists
* Lists are managed from the Mes listes module
* Lists are not displayed in the Flower Catalog grid

---

# Selection Action Bar

Displayed only when at least one flower is selected.

Position:

```text
Administration Actions
↓
Selection Action Bar
↓
Flower Grid
```

Example:

```text
3 fleurs sélectionnées

[Ajouter à une liste ▼]
[Créer une liste]
[Supprimer]
```

Administration actions remain visible.

---

# Create a List

Available only when flowers are selected.

```text
[Créer une liste]
```

Modal:

```text
Créer une nouvelle liste

Nom de la liste
[________________]

3 fleurs seront ajoutées à cette liste.

[Annuler] [Créer]
```

Rules:

* Name mandatory
* Selected flowers automatically added
* Empty lists cannot be created

Success:

```text
✓ Liste créée

Massif plein soleil

3 fleurs ajoutées
```

Recommended wording:

```text
Créer une liste à partir de la sélection
```

---

# Add to Existing Lists

Button:

```text
[Ajouter à une liste ▼]
```

Modal:

```text
Ajouter à des listes

Rechercher une liste...
[________________]

☑ Massif plein soleil
☑ Prairie fleurie
☐ Bordure terrasse
☐ Coin ombragé

3 fleurs seront ajoutées aux listes sélectionnées.

[Annuler] [Ajouter]
```

Users can select multiple lists simultaneously.

---

# Duplicate Handling

A flower can only appear once in a given list.

Example:

```text
✓ 7 ajouts effectués
⚠ 2 associations déjà existantes ignorées
```

Rules:

* Existing associations ignored
* Missing associations added
* No error generated

---

# List Management Restrictions

From the Flower Catalog users may:

```text
✓ Créer une liste
✓ Ajouter à une liste
✓ Supprimer des fleurs
```

Users may not:

```text
✗ Voir le contenu d'une liste
✗ Renommer une liste
✗ Supprimer une liste
✗ Retirer une fleur d'une liste
```

These actions belong to the Mes listes module.

---

# Main Grid

Default columns:

|  | Photo | Nom | Hauteur(cm) | Type | Sol | Exposition | Floraison | Couleurs fleurs| Couleurs feuilles | T° min(°C)| Persistant | Espacement(cm) | Plantation | Actions |
| --------- | ----- | --- | ----------- | ---- | --- | ---------- | --------- | --------------- | ------------ | ------------------- | ---------- | -------------- |---------- | ------- |

---

# Example Row

```text
☐

🌸 Achillée
Achillea millefolium

50–80 
Vivace
Drainé
☀◐
Juin→Sep
⚪
🟢
-10
✓
Printemps

✏️ 🗑️
```

---

# Multi-Selection

Multi-selection supports:

* List creation
* Adding to lists
* Bulk deletion

When selected:

```text
3 fleurs sélectionnées

[Ajouter à une liste ▼]
[Créer une liste]
[Supprimer]
```

Delete confirmation:

```text
Supprimer 3 fleurs ?

Achillée
Pavot
Acorus

Cette action est définitive.

[Annuler] [Supprimer]
```

---

# Pagination

Pagination is displayed below the table.

```text
1–25 sur 524 fleurs
```

Controls:

```text
← Précédent   1 2 3 4 5   Suivant →
```

Rows per page:

```text
Afficher [25 ▼]
```

Options:

```text
25
50
100
```

Default:

```text
25
```

---

# Column Design

## Photo

Width: 72px

```text
┌─────┐
│ 🌸  │
└─────┘
```

Rounded thumbnail.

Fallback:

```text
🌿
```

---

## Nom

```text
Achillée
```
---

## Hauteur

Single compact value.

```text
50–80
```

Sortable.

Filter:

```text
Min [20]
Max [150]
```

---

## Exposition

Icons only.

```text
☀
☀◐
◐
◐🌑
```

Hover tooltip:

```text
Soleil
Mi-ombre
Ombre
```

---

## Floraison

Format:

```text
Mai→Sep
```

Advantages:

* Compact
* Sortable
* Responsive
Examples:

```text
Mars→Mai
Mai→Sep
Juin→Oct
```

---

## Persistant

Icons:

```text
✓
✗
◐
```

Tooltip:

```text
Persistant
Caduc
Semi-persistant
```

---

# Column Filters

Header menu:

```text
Nom ▼
```

Options:

```text
Sort A→Z
Sort Z→A
Filtrer
Masquer colonne
```

---

# Filtres Drawer

Width:

```text
360 px
```

Contains:

## Type

```text
☑ Vivace
☐ Annuelle
☐ Graminée
☐ Arbuste
```

## Fleur / autre

```text
☑ Fleur
☐ Feuillage
☐ Graminée
☐ Autre
```

## Sol

```text
☑ Drainé
☐ Humide
☐ Argileux
☐ Léger
```

## Exposition

```text
☑ Soleil
☑ Mi-ombre
☐ Ombre
```

## Floraison

Month picker:

```text
Jan Fev Mar Avr Mai Jun Jul Aou Sep Oct Nov Dec
```

## Couleurs fleurs

Color chips:

```text
⚪ 🟡 🔴 🟣 🔵 🩷 🟠
```

## Hauteur

Range slider:

```text
0 ───────────── 250 cm
```

## Température minimale

```text
-20 ───────────── 40 °C
```

---

# Colonnes Panel

```text
☑ Photo
☑ Hauteur(cm)
☑ Type
☑ Sol
☑ Exposition
☑ Floraison
☑ Persistant
☑ Plantation

────────────

☐ Fleur/Autre
☐ T° min(°C)
☐ Couleurs fleurs
☐ Couleurs feuilles
☐ Espacement
```

Drag-and-drop enabled.

Mandatory columns:

```text
Selection
Nom
Actions
```

Cannot be removed.

---

# Empty State

When no flowers match the filters:

```text
🌱

Aucune fleur trouvée

Essayez de modifier vos filtres
ou ajoutez une nouvelle fleur.

[Ajouter une fleur]
```

---

# Import Result Status

After a CSV or image import, display a small admin summary.

```text
Dernière importation

03/06/2026 - 14:35

CSV - Mise à jour

125 lignes traitées

✓ 118 réussies
⚠ 5 avertissements
❌ 2 erreurs
```

---

# Visual Style

## Colors

```css
#2F7D32
#A5D6A7
#F8FAF7
#FFFFFF
#E5E7EB
#DC2626
#F59E0B
```

## Typography

```css
Inter SemiBold 20
Inter Medium 14
Inter Regular 14
Inter Regular 12
```

---

# Final Screen Structure

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🌿 MyLittleGarden                         [Mes listes]   [Dessiner]          │
├──────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Rechercher une fleur...                 [Filtres] [Colonnes]              │
├──────────────────────────────────────────────────────────────────────────────┤
│ ☀ Soleil ✕  Vivace ✕  Juin ✕                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ [+ Ajouter une fleur] [📄 Import CSV ▼] [🖼 Import Images ▼]               │
├──────────────────────────────────────────────────────────────────────────────┤
│ 3 fleurs sélectionnées                                                  │
│ [Ajouter à une liste ▼] [Créer une liste] [Supprimer]                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ Flower Grid                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Pagination                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# Final UX Recommendations

* Clean searchable table
* 25 rows per page by default
* Add/Edit via right-side drawers
* Confirmation before deletion
* Multi-selection for list management and deletion
* Create lists directly from selected flowers
* Add flowers to multiple existing lists
* Automatically ignore duplicate flower/list associations
* CSV import wizard with validation
* Dedicated image import workflow
* Image matching by flower name
* Import preview before commit
* Backend-managed flower identifiers
* Separation of responsibilities between Flower Catalog and Mes listes modules

This version should be considered the new master specification for the Flower Catalog module.
