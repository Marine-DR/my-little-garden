# Database schema

This diagram describes the final SQLite schema after applying every migration in
`packages/database/migrations` in numeric order (currently `001` through `005`).
It shows persisted columns and database-enforced relationships, rather than
application-level associations inferred from similarly named columns.

```mermaid
erDiagram
    REFERENTIAL_PLANT_TYPES {
        INTEGER id PK
        TEXT label
        TEXT normalized_label UK
        TEXT created_at
    }

    REFERENTIAL_SOIL_TYPES {
        INTEGER id PK
        TEXT label
        TEXT normalized_label UK
        TEXT created_at
    }

    REFERENTIAL_COLORS {
        INTEGER id PK
        TEXT label
        TEXT normalized_label UK
        TEXT created_at
    }

    REFERENTIAL_PLANT_KINDS {
        INTEGER id PK
        TEXT label
        TEXT normalized_label UK
        TEXT created_at
    }

    PLANTS {
        TEXT id PK
        TEXT name
        TEXT normalized_name UK
        INTEGER height_min_cm
        INTEGER height_max_cm
        INTEGER type_id FK
        INTEGER bloom_start_month
        INTEGER bloom_end_month
        INTEGER minimum_temperature_celsius
        TEXT foliage_persistence
        INTEGER spacing_cm
        TEXT created_at
        TEXT updated_at
    }

    PLANT_KIND_ASSIGNMENTS {
        TEXT plant_id PK, FK
        INTEGER plant_kind_id PK, FK
    }

    PLANT_SOILS {
        TEXT plant_id PK, FK
        INTEGER soil_type_id PK, FK
    }

    PLANT_FLOWER_COLORS {
        TEXT plant_id PK, FK
        INTEGER color_id PK, FK
    }

    PLANT_LEAF_COLORS {
        TEXT plant_id PK, FK
        INTEGER color_id PK, FK
    }

    PLANT_EXPOSURES {
        TEXT plant_id PK, FK
        TEXT exposure_code PK
    }

    PLANT_PLANTING_SEASONS {
        TEXT plant_id PK, FK
        TEXT season_code PK
    }

    PLANT_PHOTOS {
        TEXT plant_id PK, FK
        TEXT managed_filename UK
        TEXT media_type
        TEXT checksum_sha256
        TEXT created_at
    }

    SELECTIONS {
        TEXT id PK
        TEXT name UK
        TEXT created_at
        TEXT updated_at
    }

    SELECTION_PLANTS {
        TEXT selection_id PK, FK
        TEXT plant_id PK, FK
        TEXT added_at
    }

    SELECTION_PLANT_CHANGES {
        TEXT selection_id PK, FK
        TEXT plant_id PK
        TEXT change_kind
        TEXT plant_name
        TEXT baseline_json
        TEXT created_at
        TEXT updated_at
        TEXT photo_managed_filename
    }

    PROPERTY_PLANS {
        TEXT id PK
        TEXT name
        TEXT selection_id FK
        REAL width_cm
        REAL height_cm
        TEXT created_at
        TEXT updated_at
    }

    FLOWERBEDS {
        TEXT id PK
        TEXT property_plan_id FK
        REAL x_cm
        REAL y_cm
        REAL width_cm
        REAL height_cm
    }

    PROPERTY_PLAN_PLANT_PLACEMENTS {
        TEXT id PK
        TEXT property_plan_id FK
        TEXT flowerbed_id FK
        TEXT plant_id FK
        TEXT plant_name_snapshot
        REAL spacing_cm_snapshot
        TEXT color_snapshot
        REAL x_cm
        REAL y_cm
    }

    PROPERTY_BOUNDARY_POINTS {
        TEXT property_plan_id PK, FK
        INTEGER position PK
        REAL x_cm
        REAL y_cm
        TEXT edge_kind
        REAL edge_curvature
    }

    FLOWERBED_BOUNDARY_POINTS {
        TEXT flowerbed_id PK, FK
        INTEGER position PK
        REAL x_cm
        REAL y_cm
        TEXT edge_kind
        REAL edge_curvature
    }

    REFERENTIAL_PLANT_TYPES o|--o{ PLANTS : categorizes
    PLANTS ||--o{ PLANT_KIND_ASSIGNMENTS : has
    REFERENTIAL_PLANT_KINDS ||--o{ PLANT_KIND_ASSIGNMENTS : assigns
    PLANTS ||--o{ PLANT_SOILS : supports
    REFERENTIAL_SOIL_TYPES ||--o{ PLANT_SOILS : classifies
    PLANTS ||--o{ PLANT_FLOWER_COLORS : has
    REFERENTIAL_COLORS ||--o{ PLANT_FLOWER_COLORS : flower_color
    PLANTS ||--o{ PLANT_LEAF_COLORS : has
    REFERENTIAL_COLORS ||--o{ PLANT_LEAF_COLORS : leaf_color
    PLANTS ||--o{ PLANT_EXPOSURES : tolerates
    PLANTS ||--o{ PLANT_PLANTING_SEASONS : planted_during
    PLANTS ||--o| PLANT_PHOTOS : has
    SELECTIONS ||--o{ SELECTION_PLANTS : contains
    PLANTS ||--o{ SELECTION_PLANTS : selected_in
    SELECTIONS ||--o{ SELECTION_PLANT_CHANGES : records
    SELECTIONS o|--o{ PROPERTY_PLANS : sources
    PROPERTY_PLANS ||--o{ FLOWERBEDS : contains
    PROPERTY_PLANS ||--o{ PROPERTY_PLAN_PLANT_PLACEMENTS : places
    FLOWERBEDS o|--o{ PROPERTY_PLAN_PLANT_PLACEMENTS : groups
    PLANTS o|--o{ PROPERTY_PLAN_PLANT_PLACEMENTS : references
    PROPERTY_PLANS ||--o{ PROPERTY_BOUNDARY_POINTS : bounded_by
    FLOWERBEDS ||--o{ FLOWERBED_BOUNDARY_POINTS : bounded_by
```

## Migration evolution notes

- `001_initial_schema.sql` creates the catalog, reference data, photos,
  selections, and their join tables.
- `002_remove_selection_normalized_name.sql` rebuilds `selections`, removes
  `normalized_name`, and makes the original `name` unique.
- `003_selection_plant_changes.sql` adds selection-specific modification and
  deletion snapshots. Its `plant_id` is part of the primary key but is
  intentionally not a foreign key, allowing a deleted catalog plant to remain
  represented in a selection.
- `004_deleted_plant_photo.sql` adds the optional managed-photo filename to
  those snapshots.
- `005_property_plans.sql` adds property plans, flowerbeds, placements, and
  ordered boundary points. A placement's `flowerbed_id` and `plant_id` are
  optional and become `NULL` if their referenced row is deleted.

The database does not enforce that a placement's optional flowerbed belongs to
the same property plan as the placement; repository code must preserve that
cross-table invariant.
