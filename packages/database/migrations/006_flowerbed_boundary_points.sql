BEGIN IMMEDIATE;

CREATE TABLE flowerbed_boundary_points (
    flowerbed_id TEXT NOT NULL,
    position     INTEGER NOT NULL CHECK (position >= 0),
    x_cm         REAL NOT NULL,
    y_cm         REAL NOT NULL,
    edge_kind    TEXT NOT NULL DEFAULT 'line'
        CHECK (edge_kind IN ('line', 'circular-arc', 'elliptical-arc', 'bezier')),
    edge_curvature REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (flowerbed_id, position),
    FOREIGN KEY (flowerbed_id) REFERENCES flowerbeds (id)
        ON DELETE CASCADE
);

INSERT INTO flowerbed_boundary_points (
    flowerbed_id, position, x_cm, y_cm
)
SELECT id, 0, x_cm, y_cm FROM flowerbeds
UNION ALL
SELECT id, 1, x_cm + width_cm, y_cm FROM flowerbeds
UNION ALL
SELECT id, 2, x_cm + width_cm, y_cm + height_cm FROM flowerbeds
UNION ALL
SELECT id, 3, x_cm, y_cm + height_cm FROM flowerbeds;

COMMIT;
