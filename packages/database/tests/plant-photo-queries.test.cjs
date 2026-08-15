const assert = require('node:assert/strict');
const test = require('node:test');
const { upsertPlantPhotoQuery } = require('../dist/plant-photo-queries');
const { createDatabase, insertPlant } = require('./database-test-helpers.cjs');

test('plant-photo-queries inserts and updates one photo per plant', (t) => {
  const database = createDatabase(t);
  insertPlant(database, 'plant-rose', 'Rose', 'rose');
  const upsert = database.prepare(upsertPlantPhotoQuery);
  upsert.run(
    'plant-rose',
    'old.png',
    'image/png',
    'old-checksum',
    '2026-08-14',
  );
  upsert.run(
    'plant-rose',
    'new.webp',
    'image/webp',
    'new-checksum',
    '2026-08-15',
  );

  assert.deepEqual(
    { ...database.prepare('SELECT * FROM plant_photos').get() },
    {
      plant_id: 'plant-rose',
      managed_filename: 'new.webp',
      media_type: 'image/webp',
      checksum_sha256: 'new-checksum',
      created_at: '2026-08-15',
    },
  );
});
