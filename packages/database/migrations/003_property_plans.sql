PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

CREATE TABLE property_plans (
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

CREATE INDEX idx_property_plans_selection ON property_plans (selection_id);
CREATE INDEX idx_property_plans_updated
    ON property_plans (updated_at DESC);

CREATE TABLE flowerbeds (
    id               TEXT PRIMARY KEY,
    property_plan_id TEXT NOT NULL,
    x_cm             REAL NOT NULL,
    y_cm             REAL NOT NULL,
    width_cm         REAL NOT NULL CHECK (width_cm > 0),
    height_cm        REAL NOT NULL CHECK (height_cm > 0),
    FOREIGN KEY (property_plan_id)
        REFERENCES property_plans (id) ON DELETE CASCADE
);

CREATE INDEX idx_flowerbeds_property_plan
    ON flowerbeds (property_plan_id);

CREATE TABLE property_plan_plant_placements (
    id                    TEXT PRIMARY KEY,
    property_plan_id      TEXT NOT NULL,
    flowerbed_id          TEXT,
    plant_id              TEXT,
    plant_name_snapshot   TEXT NOT NULL CHECK (
        length(trim(plant_name_snapshot)) > 0
        AND plant_name_snapshot = trim(plant_name_snapshot)
    ),
    spacing_cm_snapshot   REAL NOT NULL CHECK (spacing_cm_snapshot >= 0),
    x_cm                  REAL NOT NULL,
    y_cm                  REAL NOT NULL,
    FOREIGN KEY (property_plan_id)
        REFERENCES property_plans (id) ON DELETE CASCADE,
    FOREIGN KEY (flowerbed_id) REFERENCES flowerbeds (id)
        ON DELETE SET NULL,
    FOREIGN KEY (plant_id) REFERENCES plants (id) ON DELETE SET NULL
);

CREATE INDEX idx_property_plan_placements_plan
    ON property_plan_plant_placements (property_plan_id);
CREATE INDEX idx_property_plan_placements_flowerbed
    ON property_plan_plant_placements (flowerbed_id);
CREATE INDEX idx_property_plan_placements_plant
    ON property_plan_plant_placements (plant_id);

COMMIT;
