BEGIN IMMEDIATE;

ALTER TABLE flowerbed_plant_placements
ADD COLUMN color_snapshot TEXT;

COMMIT;
