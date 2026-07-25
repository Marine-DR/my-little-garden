BEGIN IMMEDIATE;

CREATE TABLE property_boundary_points (
    property_plan_id TEXT NOT NULL,
    position         INTEGER NOT NULL CHECK (position >= 0),
    x_cm             REAL NOT NULL,
    y_cm             REAL NOT NULL,
    PRIMARY KEY (property_plan_id, position),
    FOREIGN KEY (property_plan_id)
        REFERENCES property_plans (id) ON DELETE CASCADE
);

INSERT INTO property_boundary_points (
    property_plan_id, position, x_cm, y_cm
)
SELECT id, 0, 0, 0 FROM property_plans
UNION ALL
SELECT id, 1, width_cm, 0 FROM property_plans
UNION ALL
SELECT id, 2, width_cm, height_cm FROM property_plans
UNION ALL
SELECT id, 3, 0, height_cm FROM property_plans;

COMMIT;
