
# Garden Planner – Flower Catalog Management
## Complete UX/UI Product Specification

Version: 1.0
Date: 03/06/2026

---

# Final UX Direction — Garden Planner Flower List

## Header

```text
🌿 Garden Planner
```

Right side:

```text
[Listes]   [Dessiner]
```

Primary action:

* **Dessiner** → filled green button
* **Listes** → secondary outlined button

---

## Toolbar

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

## Active Filters

Displayed as chips.

Example:

```text
☀ Soleil ✕
Vivace ✕
Floraison Été ✕
```

Users immediately understand why they see certain results.

---

## Administration Actions

Displayed above the grid.

```text
[+ Ajouter une fleur]   [📄 Import CSV ▼]   [🖼 Import Images ▼]
```

### Ajouter une fleur

Opens a right-side drawer.

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
⚪ 🟡 🔴 🟣 🩷 🟠

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

## CSV Import

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

CSV import uses a safe wizard:

```text
1. Upload du fichier
2. Prévisualisation
3. Validation
4. Confirmation
5. Résultat d'import
```

Example validation:

```text
125 lignes détectées

✓ 120 lignes valides
⚠ 3 lignes avec avertissements
❌ 2 lignes invalides
```

For update/delete actions, matching is based on flower name because `flower_id` is managed by the backend.

Recommended matching rule:

```text
Nom
```

If needed later:

```text
Nom + Type
```

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

Accepted files:

```text
.jpg
.jpeg
.png
.webp
.zip
```

Image matching rule:

```text
Nom du fichier image = Nom de la fleur
```

Example:

```text
Achilée Ornementale.jpg
```

matches:

```text
Achilée Ornementale
```

ZIP validation example:

```text
15 images détectées

✓ 13 fleurs reconnues
⚠ 2 images sans correspondance
```

---

# Main Grid

Default columns:

| Selection | Photo | Nom | Hauteur | Type | Sol | Exposition | Floraison | Persistant | Plantation | Actions |
| ---------- | ----- | --- | ------- | ---- | --- | ---------- | ---------- | ---------- | ---------- | ------- |

The first column is used only for multi-row deletion.

---

## Example Row

```text
☐

🌸  Achillée
    Achillea millefolium

50–80 cm
Vivace
Drainé
☀◐
Juin→Sep
✓
Printemps
✏️ 🗑️
```

---

# Multi-Row Selection

Multi-selection is available only for deletion.

When one or more rows are selected:

```text
2 fleurs sélectionnées       [Supprimer]
```

Delete confirmation:

```text
Supprimer 2 fleurs ?

Achillée
Pavot

Cette action est définitive.

[Annuler] [Supprimer]
```

The delete button is red.

---

# Row Actions

Each row has:

```text
✏️ Modifier
🗑 Supprimer
```

## Edit Flower

Clicking **Modifier** opens a right-side drawer with the same structure as “Ajouter une fleur”.

```text
Modifier la fleur
────────────────────────

[Fields...]

[Annuler] [Enregistrer]
```

Only one flower can be edited at a time.

---

## Delete One Flower

Clicking the delete icon opens a confirmation modal.

```text
Supprimer Achillée ?

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

If no image exists:

```text
🌿
```

---

## Nom

Two lines:

```text
Achillée
Achillea millefolium
```

Second line smaller and grey.

---

## Hauteur

Single compact value.

```text
50–80 cm
```

Sorting enabled.

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

Use:

```text
Mai→Sep
```

instead of month bars.

Advantages:

* extremely compact
* sortable
* easy to read
* works in responsive layouts

Examples:

```text
Mars→Mai
Mai→Sep
Juin→Oct
```

---

## Persistant

Compact icons.

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

Each column header contains:

```text
Nom ▼
```

Click:

```text
Sort A→Z
Sort Z→A
Filtrer
Masquer colonne
```

---

# Filtres Drawer

Slide panel from the right.

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
🔴 🟡 ⚪ 🟣 🩷 🟠
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
☑ Selection
☑ Photo
☑ Nom
☑ Hauteur
☑ Type
☑ Sol
☑ Exposition
☑ Floraison
☑ Persistant
☑ Plantation
☑ Actions

────────────

☐ Fleur/Autre
☐ Température
☐ Couleurs fleurs
☐ Couleurs feuilles
☐ Espace
```

Drag-and-drop enabled.

The following columns should not be removable:

```text
Selection
Nom
Actions
```

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
Inter Regular 14
Inter Regular 12
Inter Medium 14
```

---

# Final Screen Mockup

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🌿 Garden Planner                                [Listes]   [Dessiner]       │
├──────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Rechercher une fleur, couleur, sol, exposition... [Filtres] [Colonnes]    │
├──────────────────────────────────────────────────────────────────────────────┤
│ ☀ Soleil ✕    Vivace ✕    Juin ✕                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ [+ Ajouter une fleur]   [📄 Import CSV ▼]   [🖼 Import Images ▼]             │
├──────────────────────────────────────────────────────────────────────────────┤
│ ☐ │ Photo │ Nom │ Hauteur │ Type │ Sol │ Expo │ Floraison │ Pers. │ Actions │
├──────────────────────────────────────────────────────────────────────────────┤
│ ☐ │ 🌸    │ Achillée │50-80│Vivace│Drainé│☀◐│Juin→Sep│✓│✏️ 🗑️              │
│ ☐ │ 🌺    │ Pavot    │15-100│Vivace│Drainé│☀│Mai→Sep│✗│✏️ 🗑️              │
│ ☐ │ 🌿    │ Acorus   │15-120│Vivace│Humide│☀◐│—│◐│✏️ 🗑️                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ 1–25 sur 524 fleurs                 ← Précédent   1 2 3 4 5   Suivant →     │
│ Afficher [25 ▼]                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

# Final Recommendation

For this internal administrator screen, the best UX is:

* A clean searchable table
* 25 flowers per page by default
* Add and edit through right-side drawers
* Single-row delete with confirmation
* Multi-row selection only for deletion
* CSV import wizard for add, update, delete, and replace
* Dedicated image import for single image or ZIP
* Image matching by flower name
* Backend-managed `flower_id`
* Import preview and validation before committing changes
