PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE;

CREATE TABLE plants_new (
    id                       TEXT PRIMARY KEY,
    name                     TEXT NOT NULL CHECK (
        length(trim(name)) > 0 AND name = trim(name)
    ),
    normalized_name          TEXT NOT NULL CHECK (length(normalized_name) > 0),
    height_min_cm            INTEGER CHECK (height_min_cm >= 0),
    height_max_cm            INTEGER CHECK (height_max_cm >= 0),
    type_id                  INTEGER,
    plant_kind               TEXT CHECK (
        plant_kind IN ('flower', 'foliage', 'grass', 'other')
    ),
    bloom_start_month        INTEGER CHECK (bloom_start_month BETWEEN 1 AND 12),
    bloom_end_month          INTEGER CHECK (bloom_end_month BETWEEN 1 AND 12),
    minimum_temperature_celsius INTEGER,
    foliage_persistence      TEXT CHECK (
        foliage_persistence IN ('evergreen', 'semi_evergreen', 'deciduous')
    ),
    spacing_cm               INTEGER CHECK (spacing_cm >= 0),
    created_at               TEXT NOT NULL,
    updated_at               TEXT NOT NULL,

    CONSTRAINT uq_plants_normalized_name UNIQUE (normalized_name),
    CONSTRAINT ck_plants_height_range CHECK (
        height_max_cm IS NULL
        OR (height_min_cm IS NOT NULL AND height_max_cm >= height_min_cm)
    ),
    CONSTRAINT ck_plants_bloom_completeness CHECK (
        (bloom_start_month IS NULL AND bloom_end_month IS NULL)
        OR (bloom_start_month IS NOT NULL AND bloom_end_month IS NOT NULL)
    ),
    CONSTRAINT fk_plants_type FOREIGN KEY (type_id)
        REFERENCES plant_types (id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT
);

INSERT INTO plants_new (
    id, name, normalized_name, height_min_cm, height_max_cm, type_id,
    plant_kind, bloom_start_month, bloom_end_month,
    minimum_temperature_celsius, foliage_persistence, spacing_cm,
    created_at, updated_at
)
SELECT
    id, name, normalized_name, height_min_cm, height_max_cm, type_id,
    plant_kind, bloom_start_month, bloom_end_month,
    minimum_temperature_celsius, foliage_persistence, spacing_cm,
    created_at, updated_at
FROM plants;

DROP TABLE plants;
ALTER TABLE plants_new RENAME TO plants;

CREATE INDEX idx_plants_type_id ON plants (type_id);
CREATE INDEX idx_plants_bloom_period
    ON plants (bloom_start_month, bloom_end_month);

PRAGMA user_version = 2;

COMMIT;

PRAGMA foreign_keys = ON;

