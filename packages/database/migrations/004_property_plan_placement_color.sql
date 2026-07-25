BEGIN IMMEDIATE;

ALTER TABLE property_plan_plant_placements
ADD COLUMN color_snapshot TEXT;

COMMIT;
