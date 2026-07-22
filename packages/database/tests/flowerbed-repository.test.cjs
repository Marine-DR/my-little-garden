const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const { SqliteFlowerbedRepository } = require('../dist');

const migration = [
  '001_initial_schema.sql',
  '002_remove_selection_normalized_name.sql',
  '003_flowerbed_designs.sql',
  '004_flowerbed_placement_color.sql',
  '005_flowerbed_boundary_points.sql',
  '006_planting_zone_boundary_points.sql',
]
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

test('saves and reads a centimetre-based flowerbed design', async (t) => {
  const database = createDatabase(t);
  insertSelectionAndPlant(database);
  const repository = new SqliteFlowerbedRepository(database);

  const saved = await repository.save({
    name: '  Terrasse sud  ',
    selectionId: 'selection-1',
    widthCm: 400.5,
    heightCm: 180,
    boundaryPoints: [
      { xCm: 15, yCm: 5 },
      { xCm: 390, yCm: 20 },
      { xCm: 370, yCm: 170 },
      { xCm: 25, yCm: 160 },
    ],
    zones: [
      {
        id: 'zone-1',
        xCm: 10,
        yCm: 15,
        widthCm: 360,
        heightCm: 140,
        boundaryPoints: [
          { xCm: 15, yCm: 20 },
          { xCm: 365, yCm: 15 },
          { xCm: 350, yCm: 150 },
          { xCm: 25, yCm: 155 },
        ],
      },
    ],
    placements: [
      {
        id: 'placement-1',
        zoneId: 'zone-1',
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
  assert.equal(saved.zoneCount, 1);
  assert.equal(saved.placementCount, 1);
  assert.deepEqual(saved.boundaryPoints, [
    { xCm: 15, yCm: 5 },
    { xCm: 390, yCm: 20 },
    { xCm: 370, yCm: 170 },
    { xCm: 25, yCm: 160 },
  ]);
  assert.match(saved.zones[0].id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(
    { ...saved.zones[0], id: undefined },
    {
      id: undefined,
      xCm: 10,
      yCm: 15,
      widthCm: 360,
      heightCm: 140,
      boundaryPoints: [
        { xCm: 15, yCm: 20 },
        { xCm: 365, yCm: 15 },
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
      zoneId: undefined,
    },
    {
      id: undefined,
      zoneId: undefined,
      plantId: 'plant-1',
      plantNameSnapshot: 'Lavande',
      spacingCmSnapshot: 45,
      colorSnapshot: 'Violet',
      xCm: 50.25,
      yCm: 72.5,
    },
  );
  assert.equal(saved.placements[0].zoneId, saved.zones[0].id);
  assert.equal((await repository.list())[0].id, saved.id);
});

test('updates atomically and deletes removed child geometry', async (t) => {
  const database = createDatabase(t);
  const repository = new SqliteFlowerbedRepository(database);
  const created = await repository.save({
    name: 'Premier plan',
    selectionId: null,
    widthCm: 200,
    heightCm: 100,
    zones: [{ id: 'old-zone', xCm: 0, yCm: 0, widthCm: 100, heightCm: 100 }],
    placements: [
      {
        id: 'old-placement',
        zoneId: 'old-zone',
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
    zones: [],
    placements: [],
  });

  assert.equal(updated.id, created.id);
  assert.equal(updated.createdAt, created.createdAt);
  assert.equal(updated.name, 'Plan final');
  assert.deepEqual(updated.zones, []);
  assert.deepEqual(updated.placements, []);
  assert.deepEqual(updated.boundaryPoints, [
    { xCm: 0, yCm: 0 },
    { xCm: 250, yCm: 0 },
    { xCm: 250, yCm: 120 },
    { xCm: 0, yCm: 120 },
  ]);
  assert.equal(
    database.prepare('SELECT count(*) AS count FROM planting_zones').get()
      .count,
    0,
  );
  assert.equal(
    database
      .prepare('SELECT count(*) AS count FROM flowerbed_boundary_points')
      .get().count,
    4,
  );
});

test('keeps snapshots when linked catalog and selection records disappear', async (t) => {
  const database = createDatabase(t);
  insertSelectionAndPlant(database);
  const repository = new SqliteFlowerbedRepository(database);
  const saved = await repository.save({
    name: 'Plan durable',
    selectionId: 'selection-1',
    widthCm: 200,
    heightCm: 100,
    zones: [],
    placements: [
      {
        zoneId: null,
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

test('deletes a flowerbed and its children', async (t) => {
  const database = createDatabase(t);
  const repository = new SqliteFlowerbedRepository(database);
  const saved = await repository.save({
    name: 'À supprimer',
    selectionId: null,
    widthCm: 100,
    heightCm: 100,
    zones: [{ xCm: 0, yCm: 0, widthCm: 100, heightCm: 100 }],
    placements: [],
  });

  assert.equal(await repository.delete(saved.id), true);
  assert.equal(await repository.delete(saved.id), false);
  assert.equal(await repository.get(saved.id), null);
  assert.equal(
    database.prepare('SELECT count(*) AS count FROM planting_zones').get()
      .count,
    0,
  );
  assert.equal(
    database
      .prepare('SELECT count(*) AS count FROM flowerbed_boundary_points')
      .get().count,
    0,
  );
  assert.equal(
    database
      .prepare('SELECT count(*) AS count FROM planting_zone_boundary_points')
      .get().count,
    0,
  );
});
