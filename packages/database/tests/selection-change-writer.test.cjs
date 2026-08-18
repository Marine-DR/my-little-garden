const assert = require('node:assert/strict');
const test = require('node:test');
const {
  recordDeletedPlantChanges,
} = require('../dist/selection-change-writer');
const { createDatabase, insertPlant } = require('./database-test-helpers.cjs');

test('selection-change-writer snapshots deleted plants and touches selections', (t) => {
  const database = createDatabase(t);
  insertPlant(database, 'plant-rose', 'Rose', 'rose');
  database.exec(`
    INSERT INTO plant_photos
      (plant_id, managed_filename, media_type, checksum_sha256, created_at)
    VALUES ('plant-rose', 'rose.png', 'image/png', 'checksum', '2026-08-15');
    INSERT INTO selections (id, name, created_at, updated_at)
    VALUES ('selection-1', 'Massif', '2026-08-14', '2026-08-14');
    INSERT INTO selection_plants (selection_id, plant_id, added_at)
    VALUES ('selection-1', 'plant-rose', '2026-08-14');
  `);

  recordDeletedPlantChanges(
    database,
    ['plant-rose'],
    '2026-08-15T12:00:00.000Z',
  );

  assert.deepEqual(
    {
      ...database
        .prepare(
          `SELECT change_kind, plant_name, photo_managed_filename
           FROM selection_plant_changes`,
        )
        .get(),
    },
    {
      change_kind: 'deleted',
      plant_name: 'Rose',
      photo_managed_filename: 'rose.png',
    },
  );
  assert.equal(
    database.prepare('SELECT updated_at FROM selections').get().updated_at,
    '2026-08-15T12:00:00.000Z',
  );
});
