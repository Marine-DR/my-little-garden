PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

CREATE TABLE plant_types (
    id               INTEGER PRIMARY KEY,
    label            TEXT NOT NULL CHECK (length(trim(label)) > 0),
    normalized_label TEXT NOT NULL CHECK (length(normalized_label) > 0),
    created_at       TEXT NOT NULL,
    CONSTRAINT uq_plant_types_normalized_label UNIQUE (normalized_label)
);

CREATE TABLE soil_types (
    id               INTEGER PRIMARY KEY,
    label            TEXT NOT NULL CHECK (length(trim(label)) > 0),
    normalized_label TEXT NOT NULL CHECK (length(normalized_label) > 0),
    created_at       TEXT NOT NULL,
    CONSTRAINT uq_soil_types_normalized_label UNIQUE (normalized_label)
);

CREATE TABLE colors (
    id               INTEGER PRIMARY KEY,
    label            TEXT NOT NULL CHECK (length(trim(label)) > 0),
    normalized_label TEXT NOT NULL CHECK (length(normalized_label) > 0),
    created_at       TEXT NOT NULL,
    CONSTRAINT uq_colors_normalized_label UNIQUE (normalized_label)
);

CREATE TABLE plants (
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
    bloom_start_month        INTEGER CHECK (
        bloom_start_month BETWEEN 1 AND 12
    ),
    bloom_end_month          INTEGER CHECK (
        bloom_end_month BETWEEN 1 AND 12
    ),
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

CREATE INDEX idx_plants_type_id ON plants (type_id);
CREATE INDEX idx_plants_bloom_period
    ON plants (bloom_start_month, bloom_end_month);

CREATE TABLE plant_soils (
    plant_id     TEXT NOT NULL,
    soil_type_id INTEGER NOT NULL,
    PRIMARY KEY (plant_id, soil_type_id),
    FOREIGN KEY (plant_id) REFERENCES plants (id) ON DELETE CASCADE,
    FOREIGN KEY (soil_type_id) REFERENCES soil_types (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE INDEX idx_plant_soils_soil_plant
    ON plant_soils (soil_type_id, plant_id);

CREATE TABLE plant_flower_colors (
    plant_id TEXT NOT NULL,
    color_id INTEGER NOT NULL,
    PRIMARY KEY (plant_id, color_id),
    FOREIGN KEY (plant_id) REFERENCES plants (id) ON DELETE CASCADE,
    FOREIGN KEY (color_id) REFERENCES colors (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE INDEX idx_plant_flower_colors_color_plant
    ON plant_flower_colors (color_id, plant_id);

CREATE TABLE plant_leaf_colors (
    plant_id TEXT NOT NULL,
    color_id INTEGER NOT NULL,
    PRIMARY KEY (plant_id, color_id),
    FOREIGN KEY (plant_id) REFERENCES plants (id) ON DELETE CASCADE,
    FOREIGN KEY (color_id) REFERENCES colors (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE INDEX idx_plant_leaf_colors_color_plant
    ON plant_leaf_colors (color_id, plant_id);

CREATE TABLE plant_exposures (
    plant_id      TEXT NOT NULL,
    exposure_code TEXT NOT NULL CHECK (
        exposure_code IN ('sun', 'partial_shade', 'shade')
    ),
    PRIMARY KEY (plant_id, exposure_code),
    FOREIGN KEY (plant_id) REFERENCES plants (id) ON DELETE CASCADE
);

CREATE INDEX idx_plant_exposures_code_plant
    ON plant_exposures (exposure_code, plant_id);

CREATE TABLE plant_planting_seasons (
    plant_id    TEXT NOT NULL,
    season_code TEXT NOT NULL CHECK (
        season_code IN ('spring', 'summer', 'autumn', 'winter')
    ),
    PRIMARY KEY (plant_id, season_code),
    FOREIGN KEY (plant_id) REFERENCES plants (id) ON DELETE CASCADE
);

CREATE INDEX idx_plant_planting_seasons_code_plant
    ON plant_planting_seasons (season_code, plant_id);

CREATE TABLE plant_photos (
    plant_id          TEXT PRIMARY KEY,
    managed_filename  TEXT NOT NULL UNIQUE,
    media_type        TEXT NOT NULL,
    checksum_sha256   TEXT NOT NULL,
    created_at        TEXT NOT NULL,
    FOREIGN KEY (plant_id) REFERENCES plants (id) ON DELETE CASCADE
);

CREATE TABLE selections (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL CHECK (
        length(trim(name)) > 0 AND name = trim(name)
    ),
    normalized_name TEXT NOT NULL CHECK (length(normalized_name) > 0),
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    CONSTRAINT uq_selections_normalized_name UNIQUE (normalized_name)
);

CREATE TABLE selection_plants (
    selection_id TEXT NOT NULL,
    plant_id     TEXT NOT NULL,
    added_at     TEXT NOT NULL,
    PRIMARY KEY (selection_id, plant_id),
    FOREIGN KEY (selection_id) REFERENCES selections (id) ON DELETE CASCADE,
    FOREIGN KEY (plant_id) REFERENCES plants (id) ON DELETE CASCADE
);

CREATE INDEX idx_selection_plants_plant_selection
    ON selection_plants (plant_id, selection_id);

COMMIT;
