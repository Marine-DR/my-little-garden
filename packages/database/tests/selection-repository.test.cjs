const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const { SqliteSelectionRepository } = require('../dist');

const migration = [
  '001_initial_schema.sql',
  '002_remove_selection_normalized_name.sql',
]
  .map((filename) =>
    readFileSync(join(__dirname, '..', 'migrations', filename), 'utf8'),
  )
  .join('\n');

function createDatabase(t) {
  const database = new DatabaseSync(':memory:');
  database.exec(migration);
  t.after(() => database.close());
  return database;
}

function createRepository(
  database,
  plantRepository = { listByIds: async () => [] },
) {
  return new SqliteSelectionRepository(database, plantRepository);
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
  const repository = createRepository(database);

  database
    .prepare(
      `INSERT INTO selections (
        id, name, created_at, updated_at
      ) VALUES (?, ?, ?, ?)`,
    )
    .run(
      'selection-1',
      'Bordure plein soleil',
      '2026-07-10T08:00:00.000Z',
      '2026-07-14T12:30:00.000Z',
    );
  database
    .prepare(
      `INSERT INTO selections (
        id, name, created_at, updated_at
      ) VALUES (?, ?, ?, ?)`,
    )
    .run(
      'selection-2',
      'Selection vide',
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

test('creates a trimmed named selection with unique plant links', async (t) => {
  const database = createDatabase(t);
  const repository = createRepository(database);
  insertPlant(database, 'plant-1', 'Rose', 'rose');
  insertPlant(database, 'plant-2', 'Sauge', 'sauge');

  const result = await repository.create({
    name: '  Coin parfumé  ',
    plantIds: ['plant-1', 'plant-2', 'plant-1'],
  });

  assert.equal(result.ok, true);
  assert.equal(result.name, 'Coin parfumé');
  assert.equal(result.plantCount, 2);
  const selection = database
    .prepare('SELECT name FROM selections WHERE id = ?')
    .get(result.selectionId);
  assert.equal(selection.name, 'Coin parfumé');
  const links = database
    .prepare(
      `SELECT plant_id FROM selection_plants
       WHERE selection_id = ? ORDER BY plant_id`,
    )
    .all(result.selectionId);
  assert.deepEqual(
    links.map(({ plant_id }) => plant_id),
    ['plant-1', 'plant-2'],
  );
});

test('gets a selection using the injected catalog lookup', async (t) => {
  const database = createDatabase(t);
  const requestedPlantIds = [];
  const repository = createRepository(database, {
    async listByIds(plantIds) {
      requestedPlantIds.push([...plantIds]);
      return [
        {
          id: 'plant-1',
          name: 'Rose ancienne',
          soils: [{ id: 1, label: 'Drainé' }],
          exposures: ['sun'],
        },
      ];
    },
  });
  insertPlant(database, 'plant-1', 'Rose ancienne', 'rose ancienne');
  database
    .prepare(
      `INSERT INTO selections (
        id, name, created_at, updated_at
      ) VALUES (
        'selection-1', 'Bordure plein soleil',
        '2026-07-10T08:00:00.000Z', '2026-07-14T12:30:00.000Z'
      )`,
    )
    .run();
  database
    .prepare(
      `INSERT INTO selection_plants (selection_id, plant_id, added_at)
       VALUES ('selection-1', 'plant-1', '2026-07-14T12:30:00.000Z')`,
    )
    .run();

  const result = await repository.get('selection-1');

  assert.equal(result.name, 'Bordure plein soleil');
  assert.equal(result.plants.length, 1);
  assert.equal(result.plants[0].name, 'Rose ancienne');
  assert.deepEqual(result.plants[0].soils, [{ id: 1, label: 'Drainé' }]);
  assert.deepEqual(result.plants[0].exposures, ['sun']);
  assert.deepEqual(requestedPlantIds, [['plant-1']]);
  assert.equal(await repository.get('missing-selection'), null);
  assert.deepEqual(requestedPlantIds, [['plant-1']]);
});

test('removes only selection links and keeps catalog plants', async (t) => {
  const database = createDatabase(t);
  const repository = new SqliteSelectionRepository(database);
  insertPlant(database, 'plant-1', 'Rose', 'rose');
  insertPlant(database, 'plant-2', 'Sauge', 'sauge');
  database
    .prepare(
      `INSERT INTO selections (
        id, name, created_at, updated_at
      ) VALUES (
        'selection-1', 'Coin parfumé',
        '2026-07-10T08:00:00.000Z', '2026-07-10T08:00:00.000Z'
      )`,
    )
    .run();
  database
    .prepare(
      `INSERT INTO selection_plants (selection_id, plant_id, added_at)
       VALUES ('selection-1', ?, '2026-07-10T08:00:00.000Z')`,
    )
    .run('plant-1');
  database
    .prepare(
      `INSERT INTO selection_plants (selection_id, plant_id, added_at)
       VALUES ('selection-1', ?, '2026-07-10T08:00:00.000Z')`,
    )
    .run('plant-2');

  const result = await repository.removePlants('selection-1', [
    'plant-1',
    'plant-1',
    'plant-2',
  ]);

  assert.deepEqual(result.plants, []);
  assert.equal(
    database.prepare('SELECT count(*) AS count FROM plants').get().count,
    2,
  );
  assert.deepEqual(
    database
      .prepare(
        `SELECT plant_id FROM selection_plants
         WHERE selection_id = 'selection-1' ORDER BY plant_id`,
      )
      .all()
      .map(({ plant_id }) => plant_id),
    [],
  );
  assert.equal(
    database.prepare('SELECT count(*) AS count FROM selections').get().count,
    1,
  );
  assert.equal(
    await repository.removePlants('missing-selection', ['plant-2']),
    null,
  );
});

test('rejects empty creation data and exact duplicate selection names', async (t) => {
  const database = createDatabase(t);
  const repository = createRepository(database);
  insertPlant(database, 'plant-1', 'Rose', 'rose');

  assert.deepEqual(
    await repository.create({ name: ' ', plantIds: ['plant-1'] }),
    {
      ok: false,
      code: 'empty_name',
    },
  );
  assert.deepEqual(await repository.create({ name: 'Valide', plantIds: [] }), {
    ok: false,
    code: 'no_plants',
  });
  assert.deepEqual(
    await repository.create({ name: 'Valide', plantIds: ['missing'] }),
    { ok: false, code: 'unknown_plants' },
  );

  const first = await repository.create({
    name: 'Coin parfumé',
    plantIds: ['plant-1'],
  });
  assert.equal(first.ok, true);
  assert.deepEqual(
    await repository.create({
      name: '  Coin parfumé  ',
      plantIds: ['plant-1'],
    }),
    { ok: false, code: 'duplicate_name' },
  );
  const distinctAccent = await repository.create({
    name: 'Coin parfume',
    plantIds: ['plant-1'],
  });
  assert.equal(distinctAccent.ok, true);
  assert.notEqual(distinctAccent.selectionId, first.selectionId);
  assert.equal(
    database.prepare('SELECT count(*) AS count FROM selections').get().count,
    2,
  );
});
