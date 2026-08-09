PRAGMA foreign_keys = OFF;

BEGIN IMMEDIATE;

CREATE TABLE plant_kinds (
    id               INTEGER PRIMARY KEY,
    label            TEXT NOT NULL CHECK (length(trim(label)) > 0),
    normalized_label TEXT NOT NULL CHECK (length(normalized_label) > 0),
    created_at       TEXT NOT NULL,
    CONSTRAINT uq_plant_kinds_normalized_label UNIQUE (normalized_label)
);

INSERT INTO plant_kinds (label, normalized_label, created_at)
SELECT DISTINCT
    CASE plant_kind
        WHEN 'flower' THEN 'Fleur'
        WHEN 'foliage' THEN 'Feuillage'
        WHEN 'grass' THEN 'Graminée'
        WHEN 'other' THEN 'Autre'
    END,
    CASE plant_kind
        WHEN 'flower' THEN 'fleur'
        WHEN 'foliage' THEN 'feuillage'
        WHEN 'grass' THEN 'graminee'
        WHEN 'other' THEN 'autre'
    END,
    CURRENT_TIMESTAMP
FROM plants
WHERE plant_kind IS NOT NULL;

CREATE TABLE plant_plant_kinds (
    plant_id     TEXT NOT NULL,
    plant_kind_id INTEGER NOT NULL,
    PRIMARY KEY (plant_id, plant_kind_id),
    FOREIGN KEY (plant_id) REFERENCES plants (id) ON DELETE CASCADE,
    FOREIGN KEY (plant_kind_id) REFERENCES plant_kinds (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
);

INSERT INTO plant_plant_kinds (plant_id, plant_kind_id)
SELECT p.id, pk.id
FROM plants p
JOIN plant_kinds pk ON pk.normalized_label = CASE p.plant_kind
    WHEN 'flower' THEN 'fleur'
    WHEN 'foliage' THEN 'feuillage'
    WHEN 'grass' THEN 'graminee'
    WHEN 'other' THEN 'autre'
END
WHERE p.plant_kind IS NOT NULL;

CREATE TABLE plants_without_kind (
    id                          TEXT PRIMARY KEY,
    name                        TEXT NOT NULL CHECK (
        length(trim(name)) > 0 AND name = trim(name)
    ),
    normalized_name             TEXT NOT NULL CHECK (length(normalized_name) > 0),
    height_min_cm               INTEGER CHECK (height_min_cm >= 0),
    height_max_cm               INTEGER CHECK (height_max_cm >= 0),
    type_id                     INTEGER,
    bloom_start_month           INTEGER CHECK (bloom_start_month BETWEEN 1 AND 12),
    bloom_end_month             INTEGER CHECK (bloom_end_month BETWEEN 1 AND 12),
    minimum_temperature_celsius INTEGER,
    foliage_persistence         TEXT CHECK (
        foliage_persistence IN ('evergreen', 'semi_evergreen', 'deciduous')
    ),
    spacing_cm                  INTEGER CHECK (spacing_cm >= 0),
    created_at                  TEXT NOT NULL,
    updated_at                  TEXT NOT NULL,
    CONSTRAINT uq_plants_normalized_name UNIQUE (normalized_name),
    CONSTRAINT ck_plants_height_range CHECK (
        height_min_cm IS NULL OR height_max_cm IS NULL
        OR height_max_cm >= height_min_cm
    ),
    CONSTRAINT ck_plants_bloom_completeness CHECK (
        (bloom_start_month IS NULL AND bloom_end_month IS NULL)
        OR (bloom_start_month IS NOT NULL AND bloom_end_month IS NOT NULL)
    ),
    CONSTRAINT fk_plants_type FOREIGN KEY (type_id)
        REFERENCES plant_types (id) ON UPDATE RESTRICT ON DELETE RESTRICT
);

INSERT INTO plants_without_kind (
    id, name, normalized_name, height_min_cm, height_max_cm, type_id,
    bloom_start_month, bloom_end_month, minimum_temperature_celsius,
    foliage_persistence, spacing_cm, created_at, updated_at
)
SELECT id, name, normalized_name, height_min_cm, height_max_cm, type_id,
       bloom_start_month, bloom_end_month, minimum_temperature_celsius,
       foliage_persistence, spacing_cm, created_at, updated_at
FROM plants;

DROP TABLE plants;
ALTER TABLE plants_without_kind RENAME TO plants;

CREATE INDEX idx_plants_type_id ON plants (type_id);
CREATE INDEX idx_plants_bloom_period
    ON plants (bloom_start_month, bloom_end_month);
CREATE INDEX idx_plant_plant_kinds_kind_plant
    ON plant_plant_kinds (plant_kind_id, plant_id);

COMMIT;

PRAGMA foreign_keys = ON;
