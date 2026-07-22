BEGIN IMMEDIATE;

CREATE TABLE planting_zone_boundary_points (
    planting_zone_id TEXT NOT NULL,
    position         INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),
    x_cm             REAL NOT NULL,
    y_cm             REAL NOT NULL,
    PRIMARY KEY (planting_zone_id, position),
    FOREIGN KEY (planting_zone_id) REFERENCES planting_zones (id)
        ON DELETE CASCADE
);

INSERT INTO planting_zone_boundary_points (
    planting_zone_id, position, x_cm, y_cm
)
SELECT id, 0, x_cm, y_cm FROM planting_zones
UNION ALL
SELECT id, 1, x_cm + width_cm, y_cm FROM planting_zones
UNION ALL
SELECT id, 2, x_cm + width_cm, y_cm + height_cm FROM planting_zones
UNION ALL
SELECT id, 3, x_cm, y_cm + height_cm FROM planting_zones;

COMMIT;
