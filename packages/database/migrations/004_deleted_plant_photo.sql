PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

ALTER TABLE selection_plant_changes
    ADD COLUMN photo_managed_filename TEXT;

CREATE INDEX idx_selection_plant_changes_photo
    ON selection_plant_changes (photo_managed_filename);

COMMIT;
