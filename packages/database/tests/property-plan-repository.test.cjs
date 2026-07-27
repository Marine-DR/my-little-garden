const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const {
  databaseMigrationFilenames,
  SqlitePropertyPlanRepository,
} = require('../dist');

const migration = databaseMigrationFilenames
  .map((filename) =>
    readFileSync(join(__dirname, '..', 'migrations', filename), 'utf8'),
  )
  .join('\n');

function createDatabase(t) {
  const database = new DatabaseSync(':memory:');
  database.exec(migration);
  database.exec('PRAGMA foreign_keys = ON');
  t.after(() => database.close());
  return database;
}

function insertSelectionAndPlant(database) {
  database
    .prepare(
      `INSERT INTO plants (
        id, name, normalized_name, spacing_cm, created_at, updated_at
      ) VALUES (
        'plant-1', 'Lavande', 'lavande', 45,
        '2026-07-01T08:00:00.000Z', '2026-07-01T08:00:00.000Z'
      )`,
    )
    .run();
  database
    .prepare(
      `INSERT INTO selections (id, name, created_at, updated_at)
       VALUES (
         'selection-1', 'Plein soleil',
         '2026-07-01T08:00:00.000Z', '2026-07-01T08:00:00.000Z'
       )`,
    )
    .run();
}

test('saves and reads a centimetre-based property plan', async (t) => {
  const database = createDatabase(t);
  insertSelectionAndPlant(database);
  const repository = new SqlitePropertyPlanRepository(database);

  const saved = await repository.save({
    name: '  Terrasse sud  ',
    selectionId: 'selection-1',
    widthCm: 400.5,
    heightCm: 180,
    propertyBoundaryPoints: [
      {
        xCm: 15,
        yCm: 5,
        edgeKind: 'circular-arc',
        edgeCurvature: 0.25,
      },
      { xCm: 390, yCm: 20 },
      { xCm: 400, yCm: 95 },
      { xCm: 370, yCm: 170 },
      { xCm: 25, yCm: 160 },
    ],
    flowerbeds: [
      {
        id: 'flowerbed-1',
        xCm: 10,
        yCm: 15,
        widthCm: 360,
        heightCm: 140,
        boundaryPoints: [
          {
            xCm: 15,
            yCm: 20,
            edgeKind: 'elliptical-arc',
            edgeCurvature: -0.3,
          },
          { xCm: 365, yCm: 15 },
          { xCm: 375, yCm: 80 },
          { xCm: 350, yCm: 150 },
          { xCm: 25, yCm: 155 },
        ],
      },
    ],
    placements: [
      {
        id: 'placement-1',
        flowerbedId: 'flowerbed-1',
        plantId: 'plant-1',
        plantNameSnapshot: 'Lavande',
        spacingCmSnapshot: 45,
        colorSnapshot: 'Violet',
        xCm: 50.25,
        yCm: 72.5,
      },
    ],
  });

  assert.match(saved.id, /^[0-9a-f-]{36}$/);
  assert.equal(saved.name, 'Terrasse sud');
  assert.equal(saved.widthCm, 400.5);
  assert.equal(saved.flowerbedCount, 1);
  assert.equal(saved.placementCount, 1);
  assert.deepEqual(saved.propertyBoundaryPoints, [
    {
      xCm: 15,
      yCm: 5,
      edgeKind: 'circular-arc',
      edgeCurvature: 0.25,
    },
    { xCm: 390, yCm: 20 },
    { xCm: 400, yCm: 95 },
    { xCm: 370, yCm: 170 },
    { xCm: 25, yCm: 160 },
  ]);
  assert.match(saved.flowerbeds[0].id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(
    { ...saved.flowerbeds[0], id: undefined },
    {
      id: undefined,
      xCm: 10,
      yCm: 15,
      widthCm: 360,
      heightCm: 140,
      boundaryPoints: [
        {
          xCm: 15,
          yCm: 20,
          edgeKind: 'elliptical-arc',
          edgeCurvature: -0.3,
        },
        { xCm: 365, yCm: 15 },
        { xCm: 375, yCm: 80 },
        { xCm: 350, yCm: 150 },
        { xCm: 25, yCm: 155 },
      ],
    },
  );
  assert.match(saved.placements[0].id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(
    {
      ...saved.placements[0],
      id: undefined,
      flowerbedId: undefined,
    },
    {
      id: undefined,
      flowerbedId: undefined,
      plantId: 'plant-1',
      plantNameSnapshot: 'Lavande',
      spacingCmSnapshot: 45,
      colorSnapshot: 'Violet',
      xCm: 50.25,
      yCm: 72.5,
    },
  );
  assert.equal(saved.placements[0].flowerbedId, saved.flowerbeds[0].id);
  assert.equal((await repository.list())[0].id, saved.id);
});

test('updates atomically and deletes removed child geometry', async (t) => {
  const database = createDatabase(t);
  const repository = new SqlitePropertyPlanRepository(database);
  const created = await repository.save({
    name: 'Premier plan',
    selectionId: null,
    widthCm: 200,
    heightCm: 100,
    flowerbeds: [
      { id: 'old-flowerbed', xCm: 0, yCm: 0, widthCm: 100, heightCm: 100 },
    ],
    placements: [
      {
        id: 'old-placement',
        flowerbedId: 'old-flowerbed',
        plantId: null,
        plantNameSnapshot: 'Plante libre',
        spacingCmSnapshot: 30,
        colorSnapshot: null,
        xCm: 25,
        yCm: 25,
      },
    ],
  });

  const updated = await repository.save({
    id: created.id,
    name: 'Plan final',
    selectionId: null,
    widthCm: 250,
    heightCm: 120,
    flowerbeds: [],
    placements: [],
  });

  assert.equal(updated.id, created.id);
  assert.equal(updated.createdAt, created.createdAt);
  assert.equal(updated.name, 'Plan final');
  assert.deepEqual(updated.flowerbeds, []);
  assert.deepEqual(updated.placements, []);
  assert.deepEqual(updated.propertyBoundaryPoints, [
    { xCm: 0, yCm: 0 },
    { xCm: 250, yCm: 0 },
    { xCm: 250, yCm: 120 },
    { xCm: 0, yCm: 120 },
  ]);
  assert.equal(
    database.prepare('SELECT count(*) AS count FROM flowerbeds').get().count,
    0,
  );
  assert.equal(
    database
      .prepare('SELECT count(*) AS count FROM property_boundary_points')
      .get().count,
    4,
  );
});

test('keeps snapshots when linked catalog and selection records disappear', async (t) => {
  const database = createDatabase(t);
  insertSelectionAndPlant(database);
  const repository = new SqlitePropertyPlanRepository(database);
  const saved = await repository.save({
    name: 'Plan durable',
    selectionId: 'selection-1',
    widthCm: 200,
    heightCm: 100,
    flowerbeds: [],
    placements: [
      {
        flowerbedId: null,
        plantId: 'plant-1',
        plantNameSnapshot: 'Lavande au moment du dessin',
        spacingCmSnapshot: 45,
        colorSnapshot: 'Violet',
        xCm: 25,
        yCm: 25,
      },
    ],
  });

  database.prepare("DELETE FROM plants WHERE id = 'plant-1'").run();
  database.prepare("DELETE FROM selections WHERE id = 'selection-1'").run();
  const reloaded = await repository.get(saved.id);

  assert.equal(reloaded.selectionId, null);
  assert.equal(reloaded.placements[0].plantId, null);
  assert.equal(
    reloaded.placements[0].plantNameSnapshot,
    'Lavande au moment du dessin',
  );
  assert.equal(reloaded.placements[0].spacingCmSnapshot, 45);
  assert.equal(reloaded.placements[0].colorSnapshot, 'Violet');
  assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
});

test('deletes a property plan and its children', async (t) => {
  const database = createDatabase(t);
  const repository = new SqlitePropertyPlanRepository(database);
  const saved = await repository.save({
    name: 'À supprimer',
    selectionId: null,
    widthCm: 100,
    heightCm: 100,
    flowerbeds: [{ xCm: 0, yCm: 0, widthCm: 100, heightCm: 100 }],
    placements: [],
  });

  assert.equal(await repository.delete(saved.id), true);
  assert.equal(await repository.delete(saved.id), false);
  assert.equal(await repository.get(saved.id), null);
  assert.equal(
    database.prepare('SELECT count(*) AS count FROM flowerbeds').get().count,
    0,
  );
  assert.equal(
    database
      .prepare('SELECT count(*) AS count FROM property_boundary_points')
      .get().count,
    0,
  );
  assert.equal(
    database
      .prepare('SELECT count(*) AS count FROM flowerbed_boundary_points')
      .get().count,
    0,
  );
});
