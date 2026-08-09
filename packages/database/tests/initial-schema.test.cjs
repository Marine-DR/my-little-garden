const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const { databaseMigrationFilenames } = require('../dist');

const migrations = new Map(
  databaseMigrationFilenames.map((filename) => [
    filename,
    readFileSync(join(__dirname, '..', 'migrations', filename), 'utf8'),
  ]),
);
const migration = [...migrations.values()].join('\n');
const initialMigration = migrations.get('001_initial_schema.sql');
const selectionNameMigration = migrations.get(
  '002_remove_selection_normalized_name.sql',
);
const normalizePlantKindsMigration = migrations.get(
  '006_normalize_plant_kinds.sql',
);
const now = '2026-06-27T12:00:00.000Z';

function createDatabase(t) {
  const database = new DatabaseSync(':memory:');
  database.exec(migration);
  database.exec('PRAGMA foreign_keys = ON');
  t.after(() => database.close());
  return database;
}

function insertPlant(database, values = {}) {
  const plant = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Rose',
    normalizedName: 'rose',
    bloomStart: 5,
    bloomEnd: 9,
    heightMin: null,
    heightMax: null,
    spacing: null,
    ...values,
  };

  database
    .prepare(
      `
      INSERT INTO plants (
        id, name, normalized_name, height_min_cm, height_max_cm,
        bloom_start_month, bloom_end_month, spacing_cm, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      plant.id,
      plant.name,
      plant.normalizedName,
      plant.heightMin,
      plant.heightMax,
      plant.bloomStart,
      plant.bloomEnd,
      plant.spacing,
      now,
      now,
    );
}

test('migration creates the expected tables', (t) => {
  const database = createDatabase(t);
  const tables = new Set(
    database
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all()
      .map(({ name }) => name),
  );

  assert.deepEqual(
    tables,
    new Set([
      'plant_types',
      'plant_kinds',
      'soil_types',
      'colors',
      'plants',
      'plant_soils',
      'plant_plant_kinds',
      'plant_flower_colors',
      'plant_leaf_colors',
      'plant_exposures',
      'plant_planting_seasons',
      'plant_photos',
      'selections',
      'selection_plants',
      'selection_plant_changes',
      'property_plans',
      'property_plan_plant_placements',
      'property_boundary_points',
      'flowerbed_boundary_points',
      'flowerbeds',
    ]),
  );
});

test('plants table contains the complete scalar field set', (t) => {
  const database = createDatabase(t);
  const columns = new Set(
    database
      .prepare('PRAGMA table_info(plants)')
      .all()
      .map(({ name }) => name),
  );

  assert.deepEqual(
    columns,
    new Set([
      'id',
      'name',
      'normalized_name',
      'height_min_cm',
      'height_max_cm',
      'type_id',
      'bloom_start_month',
      'bloom_end_month',
      'minimum_temperature_celsius',
      'foliage_persistence',
      'spacing_cm',
      'created_at',
      'updated_at',
    ]),
  );
});

test('migration preserves legacy plant kinds as normalized relationships', (t) => {
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  for (const [filename, sql] of migrations) {
    if (filename === '006_normalize_plant_kinds.sql') {
      break;
    }
    database.exec(sql);
  }
  database
    .prepare(
      `INSERT INTO plants (
        id, name, normalized_name, plant_kind, created_at, updated_at
       ) VALUES ('legacy-flower', 'Pivoine', 'pivoine', 'flower', ?, ?)`,
    )
    .run(now, now);

  database.exec(normalizePlantKindsMigration);
  database.exec('PRAGMA foreign_keys = ON');

  assert.deepEqual(
    database
      .prepare(
        `SELECT pk.label FROM plant_plant_kinds ppk
         JOIN plant_kinds pk ON pk.id = ppk.plant_kind_id
         WHERE ppk.plant_id = 'legacy-flower'`,
      )
      .all()
      .map(({ label }) => String(label)),
    ['Fleur'],
  );
  assert.equal(
    database
      .prepare('PRAGMA table_info(plants)')
      .all()
      .some(({ name }) => name === 'plant_kind'),
    false,
  );
  assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
});

test('selection plant changes use the selection and plant as their key', (t) => {
  const database = createDatabase(t);
  const columns = database
    .prepare('PRAGMA table_info(selection_plant_changes)')
    .all();

  assert.deepEqual(
    columns.map(({ name }) => name),
    [
      'selection_id',
      'plant_id',
      'change_kind',
      'plant_name',
      'baseline_json',
      'created_at',
      'updated_at',
      'photo_managed_filename',
    ],
  );
  assert.deepEqual(
    columns
      .filter(({ pk }) => pk > 0)
      .sort((left, right) => left.pk - right.pk)
      .map(({ name }) => name),
    ['selection_id', 'plant_id'],
  );
});

test('selections omit normalized names and enforce exact display-name uniqueness', (t) => {
  const database = createDatabase(t);
  const columns = new Set(
    database
      .prepare('PRAGMA table_info(selections)')
      .all()
      .map(({ name }) => name),
  );

  assert.deepEqual(
    columns,
    new Set(['id', 'name', 'created_at', 'updated_at']),
  );

  const insertSelection = database.prepare(
    `INSERT INTO selections (id, name, created_at, updated_at)
     VALUES (?, ?, ?, ?)`,
  );
  insertSelection.run('selection-1', 'Sélection', now, now);
  assert.throws(() =>
    insertSelection.run('selection-2', 'Sélection', now, now),
  );
  insertSelection.run('selection-3', 'Selection', now, now);
});

test('selection name migration preserves selections and plant links', (t) => {
  const database = new DatabaseSync(':memory:');
  database.exec(initialMigration);
  t.after(() => database.close());
  insertPlant(database);
  database
    .prepare(
      `INSERT INTO selections (
        id, name, normalized_name, created_at, updated_at
      ) VALUES ('selection-1', 'Bordure', 'bordure', ?, ?)`,
    )
    .run(now, now);
  database
    .prepare(
      `INSERT INTO selection_plants (selection_id, plant_id, added_at)
       VALUES ('selection-1', '00000000-0000-4000-8000-000000000001', ?)`,
    )
    .run(now);

  database.exec(selectionNameMigration);

  const selection = database.prepare('SELECT id, name FROM selections').get();
  assert.equal(selection.id, 'selection-1');
  assert.equal(selection.name, 'Bordure');
  assert.equal(
    database.prepare('SELECT count(*) AS count FROM selection_plants').get()
      .count,
    1,
  );
  assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
});

test('normalized plant names are unique', (t) => {
  const database = createDatabase(t);
  insertPlant(database);

  assert.throws(() =>
    insertPlant(database, {
      id: '00000000-0000-4000-8000-000000000002',
      name: 'Rosé',
      normalizedName: 'rose',
    }),
  );
});

test('normalized vocabulary labels are unique', (t) => {
  const database = createDatabase(t);
  const insertSoil = database.prepare(
    'INSERT INTO soil_types (label, normalized_label, created_at) VALUES (?, ?, ?)',
  );
  insertSoil.run('Drainé', 'draine', now);

  assert.throws(() => insertSoil.run('DRAINE', 'draine', now));
});

test('month, height, and spacing constraints reject invalid values', (t) => {
  const database = createDatabase(t);
  const invalidValues = [
    { bloomStart: 0 },
    { bloomEnd: 13 },
    { heightMin: -1, heightMax: 10 },
    { heightMin: 20, heightMax: 10 },
    { spacing: -1 },
  ];

  invalidValues.forEach((values, index) => {
    assert.throws(() =>
      insertPlant(database, {
        id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        normalizedName: `plant-${index + 1}`,
        ...values,
      }),
    );
  });
});

test('plants may omit bloom and provide only a minimum height', (t) => {
  const database = createDatabase(t);
  assert.doesNotThrow(() =>
    insertPlant(database, {
      bloomStart: null,
      bloomEnd: null,
      heightMin: 42,
      heightMax: null,
    }),
  );
});

test('plants may provide only a maximum height', (t) => {
  const database = createDatabase(t);
  assert.doesNotThrow(() =>
    insertPlant(database, {
      heightMin: null,
      heightMax: 120,
    }),
  );
});

test('closed constants and duplicate associations are rejected', (t) => {
  const database = createDatabase(t);
  insertPlant(database);
  const plantId = '00000000-0000-4000-8000-000000000001';
  const insertExposure = database.prepare(
    'INSERT INTO plant_exposures (plant_id, exposure_code) VALUES (?, ?)',
  );
  const insertSeason = database.prepare(
    'INSERT INTO plant_planting_seasons (plant_id, season_code) VALUES (?, ?)',
  );

  assert.throws(() => insertExposure.run(plantId, 'full_sun'));
  assert.throws(() => insertSeason.run(plantId, 'monsoon'));
  insertExposure.run(plantId, 'sun');
  assert.throws(() => insertExposure.run(plantId, 'sun'));
});

test('photo media types can evolve without a database migration', (t) => {
  const database = createDatabase(t);
  insertPlant(database);

  assert.doesNotThrow(() =>
    database
      .prepare(
        `
        INSERT INTO plant_photos (
          plant_id, managed_filename, media_type, checksum_sha256, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `,
      )
      .run(
        '00000000-0000-4000-8000-000000000001',
        'plant-photo.avif',
        'image/avif',
        'a'.repeat(64),
        now,
      ),
  );
});

test('plant deletion cascades and vocabulary deletion is restricted', (t) => {
  const database = createDatabase(t);
  const soil = database
    .prepare(
      'INSERT INTO soil_types (label, normalized_label, created_at) VALUES (?, ?, ?) RETURNING id',
    )
    .get('Drainé', 'draine', now);
  insertPlant(database);
  const plantId = '00000000-0000-4000-8000-000000000001';
  database
    .prepare('INSERT INTO plant_soils (plant_id, soil_type_id) VALUES (?, ?)')
    .run(plantId, soil.id);
  database
    .prepare(
      'INSERT INTO plant_exposures (plant_id, exposure_code) VALUES (?, ?)',
    )
    .run(plantId, 'sun');

  assert.throws(() =>
    database.prepare('DELETE FROM soil_types WHERE id = ?').run(soil.id),
  );
  database.prepare('DELETE FROM plants WHERE id = ?').run(plantId);
  assert.equal(
    database.prepare('SELECT count(*) AS total FROM plant_soils').get().total,
    0,
  );
  assert.equal(
    database.prepare('SELECT count(*) AS total FROM plant_exposures').get()
      .total,
    0,
  );
});

test('a failed graph write rolls back every table', (t) => {
  const database = createDatabase(t);

  assert.throws(() => {
    database.exec('BEGIN');
    try {
      database
        .prepare(
          'INSERT INTO soil_types (label, normalized_label, created_at) VALUES (?, ?, ?)',
        )
        .run('Argileux', 'argileux', now);
      insertPlant(database);
      database
        .prepare(
          'INSERT INTO plant_exposures (plant_id, exposure_code) VALUES (?, ?)',
        )
        .run('00000000-0000-4000-8000-000000000001', 'unsupported');
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  });

  assert.equal(
    database.prepare('SELECT count(*) AS total FROM plants').get().total,
    0,
  );
  assert.equal(
    database.prepare('SELECT count(*) AS total FROM soil_types').get().total,
    0,
  );
});

test('catalog has no application-defined entry limit', (t) => {
  const database = createDatabase(t);
  const total = 50_000;
  const soil = database
    .prepare(
      'INSERT INTO soil_types (label, normalized_label, created_at) VALUES (?, ?, ?) RETURNING id',
    )
    .get('Drainé', 'draine', now);
  const insertCatalogPlant = database.prepare(`
    INSERT INTO plants (
      id, name, normalized_name, bloom_start_month, bloom_end_month,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSoil = database.prepare(
    'INSERT INTO plant_soils (plant_id, soil_type_id) VALUES (?, ?)',
  );
  const insertExposure = database.prepare(
    'INSERT INTO plant_exposures (plant_id, exposure_code) VALUES (?, ?)',
  );

  database.exec('BEGIN');
  for (let index = 0; index < total; index += 1) {
    const id = `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
    insertCatalogPlant.run(
      id,
      `Plant ${index}`,
      `plant ${index}`,
      1,
      12,
      now,
      now,
    );
    insertSoil.run(id, soil.id);
    insertExposure.run(id, 'sun');
  }
  database.exec('COMMIT');

  assert.equal(
    database.prepare('SELECT count(*) AS total FROM plants').get().total,
    total,
  );
  assert.equal(
    database
      .prepare(
        'SELECT id FROM plants ORDER BY normalized_name LIMIT 25 OFFSET ?',
      )
      .all(total - 25).length,
    25,
  );
});
