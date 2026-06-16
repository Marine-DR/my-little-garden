
# MyLittleGarden – Flower Catalog Management

## Complete UX/UI Product Specification

**Version:** 3.1
**Date:** 12/06/2026

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
Right side:
1 display the number of active filters  
1 display the number of hiden colunms

Example:

```text
2 filtres actifs ✕  
3 colonnes cachées ✕ 
```

---

# Administration Actions

Displayed above the flower grid.

```text
[+ Ajouter une fleur]
[🗋 Import CSV ▼]
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

Couleur fleurs
⚪ 🟡 🔴 🟣 🔵 🩷 🟠

Couleur feuilles
🟢 🟡 🟤

Persistant
○ Oui
○ Non
○ Semi-persistant

Espacement
[40] à [60] cm

Plantation
☑ Été
☑ Printemps
☑ Automne
☑ Hiver

[Annuler] [Enregistrer]
```

---

# Flower Editing

Each row contains:

```text
🖉 Modifier
```

Editing opens the same drawer prefilled with existing data.

```text
Modifier la fleur
```

Only one flower may be edited at a time.

---

# CSV Import

Dropdown:

```text
📄 Import CSV
────────────────────────
+ Ajouter des fleurs
🖉 Mettre à jour des fleurs
- Supprimer des fleurs
⮔ Remplacer tout le catalogue
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

# Flower Selection Management

## Purpose

Selections are named collections of flowers.

Seletions are used later in the Dessiner module to build flowerbeds.

Rules:

* One flower may belong to multiple selections
* Selections are managed from the Mes Sélections module
* Selections are not displayed in the Flower Catalog grid

---

# Selection Action Bar

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

[Ajouter à une sélection ▼]
[Créer une sélection]
[Supprimer]
```

Administration actions remain visible.

---

# Create a List

Available only when flowers are selected.

```text
[Créer une sélection]
```

Modal:

```text
Créer une nouvelle sélection

Nom de la sélection
[________________]

3 fleurs seront ajoutées à cette sélection.

[Annuler] [Créer]
```

Rules:

* Name mandatory
* Selected flowers automatically added
* Empty selection cannot be created

Success:

```text
✓ sélection créée

Massif plein soleil

3 fleurs ajoutées
```

Recommended wording:

```text
Créer une sélection
```

---

# Add to Existing Selection

Button:

```text
[Ajouter à une sélection ▼]
```

Modal:

```text
Ajouter à des sélections

Rechercher une sélection...
[________________]

☑ Massif plein soleil
☑ Prairie fleurie
☐ Bordure terrasse
☐ Coin ombragé

3 fleurs seront ajoutées aux sélections sélectionnées.

[Annuler] [Ajouter]
```

Users can select multiple selections simultaneously.

---

# Duplicate Handling

A flower can only appear once in a given selection.

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

# Selections Management Restrictions

From the Flower Catalog users may:

```text
✓ Créer une sélection
✓ Ajouter à une sélection
✓ Supprimer des fleurs
```

Users may not:

```text
✗ Voir le contenu d'une sélection
✗ Renommer une sélection
✗ Supprimer une sélection
✗ Retirer une fleur d'une sélection
```

These actions belong to the Mes Sélections module.

---

# Main Grid

Default columns:

| | Photo | Nom | ↨ (cm) | Type | Sol | Exposition | Floraison | Couleur 🌸| Couleur 🍃 | ❅ (°C)| Persistant | ↔ (cm) | Plantation | Modifier |
| - | ----- | --- | ------ | ---- | --- | ---------- | --------- | ---------- | ---------- | ------ | ---------- | ------ | ---------- |-------- |

---

# Example Row

```text
☐
🌸 Achillée
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
30
Pintemps Automne

🖉 🗑️
```

---

# Multi-Selection

Multi-selection supports:

* Selection creation
* Adding to selection
* Bulk deletion

When selected:

```text
3 fleurs sélectionnées

[Ajouter à une sélection ▼]
[Créer une sélection]
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

Text

```text
Achillée
```
---

## Hauteur

Display in column ↨ (cm)

Single compact value.

```text
50–80
```

Sortable.

---

## Type

Text

```text
Vivace
```
---

## Sol

Text

```text
Drainée
sec
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

## Fleur/Autre

Text

```text
Fleur
```
---

## Couleur Fleurs

Display in column Couleur 🌸  
Can contains several colors  
Display color by line and add a second line in the cell if needed
Text

```text
⚪ 🟡 🔴 🟣 
🔵 🩷 🟠
```
---

## Couleur Feuilles
Display in column Couleur 🍃  
Can contains several colors  
Display color by line and add a second line in the cell if needed
Text

```text
⚪ 🟡 🟢 🔴
🟣 🟤
```
---

## Température minimale
Deisplay in column ❅ (°C)  
Text

```text
-10
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

## Espacement
Display in column ↔ (cm)  
Text

```text
30
```
---

## Plantation

Text

```text
Printemps,
Autaumne
```
---

# Column Sorting

Header menu:

```text
Nom ▼
```

Options:

```text
Sort A→Z
Sort Z→A
```

---

# Filtres Drawer

Width:

```text
360 px
```
Allow multi selection for each field.  
Contains:

## Type

```text
☑ Vivace
☐ Annuelle
☐ Graminée
☐ Arbuste
```
## Hauteur

```text
Min [20]
Max [150]
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

## Couleur fleurs

Color chips:

```text
⚪ 🟡 🔴 🟣 🔵 🩷 🟠
```

## Couleur feuilles

Color chips:

```text
⚪ 🟡 🟢 🔴 🟣 🟤
```

## Température minimale
Slider:
```text
-40 ───────────── 0 °C
```

---

## Persistant
```text
☑ Persistant
☑ Semi-persistant
☐ Caduc
```

---

## Plantation
```text
☑ Printemps
☑ Été
☐ Automne
☐ Hiver
```
## Espacement
Ranger slider:
```text
10 ───────────── 100 cm
```


# Colonnes Panel

```text
☑ Photo
☑ ↨ Hauteur(cm)
☑ Type
☑ Sol
☑ Exposition
☑ Floraison
☑ Persistant
☑ Plantation

────────────

☐ Fleur/Autre
☐ ❅ Température minimale (°C)
☐ Couleur fleurs 🌸
☐ Couleur feuilles 🍃
☐ ↔ Espacement (cm)
```

Drag-and-drop enabled.

Mandatory columns:

```text
Selection
Nom
Modifier
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

# Final Screen Structure

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ 🌿 MyLittleGarden                         [Mes Sélections]   [Mes Parterres] │
├──────────────────────────────────────────────────────────────────────────────┤
│ 🔍 Rechercher une fleur...                              [Filtres] [Colonnes] │
├──────────────────────────────────────────────────────────────────────────────┤
│                                       1 filtre actif ✕  1 colonne cachée ✕   │
├──────────────────────────────────────────────────────────────────────────────┤
│ [+ Ajouter une fleur] [🗋 Import CSV ▼] [🖼 Import Images ▼]               │
├──────────────────────────────────────────────────────────────────────────────┤
│ 3 fleurs sélectionnées                                                       │
│ [Ajouter à une Sélections ▼] [Créer une Sélections] [Supprimer]              │
├──────────────────────────────────────────────────────────────────────────────┤
│ Flower Grid                                                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ Pagination                                                                   │
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

