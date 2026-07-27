PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

CREATE TABLE selection_plant_changes (
    id            TEXT PRIMARY KEY,
    selection_id  TEXT NOT NULL,
    plant_id      TEXT NOT NULL,
    change_kind   TEXT NOT NULL CHECK (change_kind IN ('modified', 'deleted')),
    plant_name    TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    CONSTRAINT uq_selection_plant_changes UNIQUE (selection_id, plant_id),
    FOREIGN KEY (selection_id) REFERENCES selections (id) ON DELETE CASCADE
);

CREATE INDEX idx_selection_plant_changes_selection_kind
    ON selection_plant_changes (selection_id, change_kind);

COMMIT;
