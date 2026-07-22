PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

CREATE TABLE flowerbeds (
    id           TEXT PRIMARY KEY,
    name         TEXT NOT NULL CHECK (
        length(trim(name)) > 0 AND name = trim(name)
    ),
    selection_id TEXT,
    width_cm     REAL NOT NULL CHECK (width_cm > 0),
    height_cm    REAL NOT NULL CHECK (height_cm > 0),
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    FOREIGN KEY (selection_id) REFERENCES selections (id) ON DELETE SET NULL
);

CREATE INDEX idx_flowerbeds_selection ON flowerbeds (selection_id);
CREATE INDEX idx_flowerbeds_updated ON flowerbeds (updated_at DESC);

CREATE TABLE planting_zones (
    id           TEXT PRIMARY KEY,
    flowerbed_id TEXT NOT NULL,
    x_cm         REAL NOT NULL,
    y_cm         REAL NOT NULL,
    width_cm     REAL NOT NULL CHECK (width_cm > 0),
    height_cm    REAL NOT NULL CHECK (height_cm > 0),
    FOREIGN KEY (flowerbed_id) REFERENCES flowerbeds (id) ON DELETE CASCADE
);

CREATE INDEX idx_planting_zones_flowerbed ON planting_zones (flowerbed_id);

CREATE TABLE flowerbed_plant_placements (
    id                    TEXT PRIMARY KEY,
    flowerbed_id          TEXT NOT NULL,
    planting_zone_id      TEXT,
    plant_id              TEXT,
    plant_name_snapshot   TEXT NOT NULL CHECK (
        length(trim(plant_name_snapshot)) > 0
        AND plant_name_snapshot = trim(plant_name_snapshot)
    ),
    spacing_cm_snapshot   REAL NOT NULL CHECK (spacing_cm_snapshot >= 0),
    x_cm                  REAL NOT NULL,
    y_cm                  REAL NOT NULL,
    FOREIGN KEY (flowerbed_id) REFERENCES flowerbeds (id) ON DELETE CASCADE,
    FOREIGN KEY (planting_zone_id) REFERENCES planting_zones (id)
        ON DELETE SET NULL,
    FOREIGN KEY (plant_id) REFERENCES plants (id) ON DELETE SET NULL
);

CREATE INDEX idx_flowerbed_placements_flowerbed
    ON flowerbed_plant_placements (flowerbed_id);
CREATE INDEX idx_flowerbed_placements_zone
    ON flowerbed_plant_placements (planting_zone_id);
CREATE INDEX idx_flowerbed_placements_plant
    ON flowerbed_plant_placements (plant_id);

COMMIT;
