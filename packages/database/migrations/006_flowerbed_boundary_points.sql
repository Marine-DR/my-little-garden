BEGIN IMMEDIATE;

CREATE TABLE flowerbed_boundary_points (
    flowerbed_id TEXT NOT NULL,
    position     INTEGER NOT NULL CHECK (position BETWEEN 0 AND 3),
    x_cm         REAL NOT NULL,
    y_cm         REAL NOT NULL,
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
