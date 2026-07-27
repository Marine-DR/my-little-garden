PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

ALTER TABLE selection_plant_changes ADD COLUMN baseline_json TEXT;

COMMIT;
