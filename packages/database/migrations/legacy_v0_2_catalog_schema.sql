PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

ALTER TABLE plant_types RENAME TO referential_plant_types;
ALTER TABLE soil_types RENAME TO referential_soil_types;
ALTER TABLE colors RENAME TO referential_colors;

CREATE TABLE referential_plant_kinds (
    id               INTEGER PRIMARY KEY,
    label            TEXT NOT NULL CHECK (length(trim(label)) > 0),
    normalized_label TEXT NOT NULL CHECK (length(normalized_label) > 0),
    created_at       TEXT NOT NULL,
    CONSTRAINT uq_referential_plant_kinds_normalized_label UNIQUE (normalized_label)
);

CREATE TABLE plant_kind_assignments (
    plant_id      TEXT NOT NULL,
    plant_kind_id INTEGER NOT NULL,
    PRIMARY KEY (plant_id, plant_kind_id),
    FOREIGN KEY (plant_id) REFERENCES plants (id) ON DELETE CASCADE,
    FOREIGN KEY (plant_kind_id) REFERENCES referential_plant_kinds (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
);

CREATE INDEX idx_plant_kind_assignments_kind_plant
    ON plant_kind_assignments (plant_kind_id, plant_id);

INSERT INTO referential_plant_kinds (label, normalized_label, created_at)
SELECT
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
    MIN(created_at)
FROM plants
WHERE plant_kind IS NOT NULL
GROUP BY plant_kind;

INSERT INTO plant_kind_assignments (plant_id, plant_kind_id)
SELECT p.id, pk.id
FROM plants p
JOIN referential_plant_kinds pk
    ON pk.normalized_label = CASE p.plant_kind
        WHEN 'flower' THEN 'fleur'
        WHEN 'foliage' THEN 'feuillage'
        WHEN 'grass' THEN 'graminee'
        WHEN 'other' THEN 'autre'
    END
WHERE p.plant_kind IS NOT NULL;

ALTER TABLE plants DROP COLUMN plant_kind;

COMMIT;
