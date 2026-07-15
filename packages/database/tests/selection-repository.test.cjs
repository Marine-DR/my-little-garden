const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const { SqliteSelectionRepository } = require('../dist');

const migration = readFileSync(
  join(__dirname, '..', 'migrations', '001_initial_schema.sql'),
  'utf8',
);

function createDatabase(t) {
  const database = new DatabaseSync(':memory:');
  database.exec(migration);
  t.after(() => database.close());
  return database;
}

function insertPlant(database, id, name, normalizedName, photoFilename = null) {
  database
    .prepare(
      `INSERT INTO plants (id, name, normalized_name, created_at, updated_at)
       VALUES (?, ?, ?, '2026-07-01T08:00:00.000Z',
               '2026-07-01T08:00:00.000Z')`,
    )
    .run(id, name, normalizedName);
  if (photoFilename) {
    database
      .prepare(
        `INSERT INTO plant_photos (
          plant_id, managed_filename, media_type, checksum_sha256, created_at
        ) VALUES (?, ?, 'image/png', 'checksum', '2026-07-01T08:00:00.000Z')`,
      )
      .run(id, photoFilename);
  }
}

test('lists selection summaries with plant counts and four preview images', async (t) => {
  const database = createDatabase(t);
  const repository = new SqliteSelectionRepository(database);

  database
    .prepare(
      `INSERT INTO selections (
        id, name, normalized_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      'selection-1',
      'Bordure plein soleil',
      'bordure plein soleil',
      '2026-07-10T08:00:00.000Z',
      '2026-07-14T12:30:00.000Z',
    );
  database
    .prepare(
      `INSERT INTO selections (
        id, name, normalized_name, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      'selection-2',
      'Selection vide',
      'selection vide',
      '2026-07-09T08:00:00.000Z',
      '2026-07-09T08:00:00.000Z',
    );

  for (let index = 1; index <= 5; index += 1) {
    insertPlant(
      database,
      `plant-${index}`,
      `Plante ${index}`,
      `plante ${index}`,
      `plant-${index}.png`,
    );
    database
      .prepare(
        `INSERT INTO selection_plants (selection_id, plant_id, added_at)
         VALUES ('selection-1', ?, '2026-07-14T12:30:00.000Z')`,
      )
      .run(`plant-${index}`);
  }

  const result = await repository.listSummaries();

  assert.equal(result.length, 2);
  assert.equal(result[0].name, 'Bordure plein soleil');
  assert.equal(result[0].plantCount, 5);
  assert.deepEqual(result[0].previewManagedFilenames, [
    'plant-1.png',
    'plant-2.png',
    'plant-3.png',
    'plant-4.png',
  ]);
  assert.equal(result[1].name, 'Selection vide');
  assert.equal(result[1].plantCount, 0);
  assert.deepEqual(result[1].previewManagedFilenames, []);
});
