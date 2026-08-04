const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const {
  databaseMigrationFilenames,
  SqlitePlantCatalogRepository,
} = require('../dist');

const migration = databaseMigrationFilenames
  .map((filename) =>
    readFileSync(join(__dirname, '..', 'migrations', filename), 'utf8'),
  )
  .join('\n');

function createCatalog(t) {
  const database = new DatabaseSync(':memory:');
  database.exec(migration);
  t.after(() => database.close());
  const plant = database.prepare(`INSERT INTO plants (
    id, name, normalized_name, bloom_start_month, bloom_end_month,
    created_at, updated_at
  ) VALUES (?, ?, ?, 5, 9, '2026-06-28', '2026-06-28')`);
  const soil = database
    .prepare(
      `
    INSERT INTO soil_types (label, normalized_label, created_at)
    VALUES ('Drainé', 'draine', '2026-06-28') RETURNING id
  `,
    )
    .get();
  const humidSoil = database
    .prepare(
      `
    INSERT INTO soil_types (label, normalized_label, created_at)
    VALUES ('Humide', 'humide', '2026-06-28') RETURNING id
  `,
    )
    .get();
  const colors = new Map();
  for (const label of ['Blanc', 'Rose', 'Violet']) {
    const color = database
      .prepare(
        `INSERT INTO colors (label, normalized_label, created_at)
         VALUES (?, ?, '2026-06-28') RETURNING id`,
      )
      .get(label, label.toLowerCase());
    colors.set(label, Number(color.id));
  }
  for (let index = 0; index < 30; index += 1) {
    const suffix = String(index).padStart(2, '0');
    const id = `plant-${suffix}`;
    const name =
      index === 0 ? 'Échinacée' : index === 1 ? 'Achillée' : `Plante ${suffix}`;
    const normalized =
      index === 0 ? 'echinacee' : index === 1 ? 'achillee' : `plante ${suffix}`;
    plant.run(id, name, normalized);
    database
      .prepare('INSERT INTO plant_soils (plant_id, soil_type_id) VALUES (?, ?)')
      .run(id, Number(soil.id));
    if (index === 1) {
      database
        .prepare(
          'INSERT INTO plant_soils (plant_id, soil_type_id) VALUES (?, ?)',
        )
        .run(id, Number(humidSoil.id));
      database
        .prepare(
          `UPDATE plants SET bloom_start_month = 11, bloom_end_month = 2
           WHERE id = ?`,
        )
        .run(id);
    }
    database
      .prepare(
        `
      INSERT INTO plant_exposures (plant_id, exposure_code) VALUES (?, 'sun')
    `,
      )
      .run(id);
    if (index === 1) {
      database
        .prepare(
          `
        INSERT INTO plant_exposures (plant_id, exposure_code)
        VALUES (?, 'shade')
      `,
        )
        .run(id);
    }
    const flowerColors =
      index === 0 ? ['Blanc', 'Rose'] : index === 1 ? ['Violet'] : ['Rose'];
    for (const color of flowerColors) {
      database
        .prepare(
          `INSERT INTO plant_flower_colors (plant_id, color_id)
           VALUES (?, ?)`,
        )
        .run(id, colors.get(color));
    }
  }
  return new SqlitePlantCatalogRepository(database);
}

function plantNames(result) {
  return result.items.map(({ name }) => name);
}

test('lists one alphabetically sorted domain plant per name', async (t) => {
  const repository = createCatalog(t);
  const result = await repository.list({ offset: 0, limit: 25 });

  assert.equal(result.total, 30);
  assert.equal(result.items.length, 25);
  assert.equal(result.items[0].name, 'Achillée');
  assert.deepEqual(result.items[0].soils, [
    { id: 1, label: 'Drainé' },
    { id: 2, label: 'Humide' },
  ]);
  assert.deepEqual(result.items[0].exposures, ['sun', 'shade']);
  assert.equal(new Set(result.items.map(({ name }) => name)).size, 25);
});

test('uses offset and limit for subsequent pages', async (t) => {
  const repository = createCatalog(t);
  const result = await repository.list({ offset: 25, limit: 25 });

  assert.equal(result.total, 30);
  assert.equal(result.items.length, 5);
});

test('lists and hydrates catalog plants by id', async (t) => {
  const repository = createCatalog(t);
  const result = await repository.listByIds([
    'plant-00',
    'plant-01',
    'plant-00',
    'missing-plant',
  ]);

  assert.deepEqual(
    result.map(({ name }) => name),
    ['Achillée', 'Échinacée'],
  );
  assert.deepEqual(result[0].soils, [
    { id: 1, label: 'Drainé' },
    { id: 2, label: 'Humide' },
  ]);
  assert.deepEqual(result[0].exposures, ['sun', 'shade']);
  assert.deepEqual(await repository.listByIds([]), []);
});

test('upserts and finds a hydrated plant by id or normalized name', async (t) => {
  const database = new DatabaseSync(':memory:');
  database.exec(migration);
  t.after(() => database.close());
  const repository = new SqlitePlantCatalogRepository(database);

  const created = await repository.upsert({
    id: 'plant-sage',
    name: 'Sauge officinale',
    heightCm: { min: 30, max: 60 },
    typeLabel: 'Vivace',
    kind: 'flower',
    soilLabels: ['Drainé'],
    exposures: ['sun'],
    bloom: { startMonth: 6, endMonth: 8 },
    flowerColorLabels: ['Violet'],
    leafColorLabels: ['Vert'],
    minimumTemperatureCelsius: -10,
    foliagePersistence: 'semi_evergreen',
    spacingCm: 40,
    plantingSeasons: ['spring', 'autumn'],
    photo: {
      managedFilename: 'sage.png',
      mediaType: 'image/png',
      checksumSha256: 'checksum-1',
    },
  });

  assert.equal(created.id, 'plant-sage');
  assert.equal(created.name, 'Sauge officinale');
  assert.deepEqual(created.soils, [{ id: 1, label: 'Drainé' }]);
  assert.deepEqual(created.exposures, ['sun']);
  assert.equal(created.photo.managedFilename, 'sage.png');
  assert.equal(
    (await repository.findByNormalizedName('sauge officinale')).id,
    'plant-sage',
  );

  const updated = await repository.upsert({
    id: 'plant-sage',
    name: 'Sauge officinale',
    heightCm: { min: 40, max: 70 },
    typeLabel: null,
    kind: 'foliage',
    soilLabels: ['Humide'],
    exposures: ['partial_shade'],
    bloom: null,
    flowerColorLabels: [],
    leafColorLabels: ['Gris vert'],
    minimumTemperatureCelsius: -8,
    foliagePersistence: 'evergreen',
    spacingCm: 50,
    plantingSeasons: ['autumn'],
    photo: null,
  });

  assert.equal(updated.heightCm.min, 40);
  assert.equal(updated.type, null);
  assert.deepEqual(updated.soils, [{ id: 2, label: 'Humide' }]);
  assert.deepEqual(updated.exposures, ['partial_shade']);
  assert.deepEqual(updated.flowerColors, []);
  assert.deepEqual(updated.leafColors, [{ id: 3, label: 'Gris vert' }]);
  assert.equal(updated.photo, null);
  assert.equal(await repository.findById('missing-plant'), null);
});

test('deletes plants and records every affected selection atomically', (t) => {
  const database = new DatabaseSync(':memory:');
  database.exec(migration);
  t.after(() => database.close());
  const repository = new SqlitePlantCatalogRepository(database);
  const insertPlant = database.prepare(
    `INSERT INTO plants (
       id, name, normalized_name, created_at, updated_at
     ) VALUES (?, ?, ?, '2026-07-31', '2026-07-31')`,
  );
  insertPlant.run('plant-rose', 'Rose', 'rose');
  insertPlant.run('plant-sage', 'Sauge', 'sauge');
  database
    .prepare(
      `INSERT INTO plant_photos (
         plant_id, managed_filename, media_type, checksum_sha256, created_at
       ) VALUES ('plant-rose', 'rose.png', 'image/png', 'checksum', '2026-07-31')`,
    )
    .run();
  const insertSelection = database.prepare(
    `INSERT INTO selections (id, name, created_at, updated_at)
     VALUES (?, ?, '2026-07-31', '2026-07-31')`,
  );
  insertSelection.run('selection-1', 'Massif');
  insertSelection.run('selection-2', 'Prairie');
  const insertLink = database.prepare(
    `INSERT INTO selection_plants (selection_id, plant_id, added_at)
     VALUES (?, ?, '2026-07-31')`,
  );
  insertLink.run('selection-1', 'plant-rose');
  insertLink.run('selection-1', 'plant-sage');
  insertLink.run('selection-2', 'plant-rose');
  database
    .prepare(
      `INSERT INTO selection_plant_changes (
         selection_id, plant_id, change_kind, plant_name, baseline_json,
         created_at, updated_at
       ) VALUES (
         'selection-1', 'plant-rose', 'modified', 'Rose', '{}',
         '2026-07-30', '2026-07-30'
       )`,
    )
    .run();

  assert.deepEqual(repository.deletePlants(['plant-rose', 'plant-rose']), {
    ok: true,
    deletedPlantCount: 1,
    affectedSelectionCount: 2,
  });
  assert.deepEqual(
    database
      .prepare('SELECT id FROM plants ORDER BY id')
      .all()
      .map(({ id }) => ({ id })),
    [{ id: 'plant-sage' }],
  );
  assert.deepEqual(
    database
      .prepare(
        'SELECT selection_id, plant_id FROM selection_plants ORDER BY selection_id, plant_id',
      )
      .all()
      .map(({ selection_id, plant_id }) => ({ selection_id, plant_id })),
    [{ selection_id: 'selection-1', plant_id: 'plant-sage' }],
  );
  assert.deepEqual(
    database
      .prepare(
        `SELECT selection_id, plant_id, change_kind, plant_name,
                baseline_json, photo_managed_filename
         FROM selection_plant_changes ORDER BY selection_id`,
      )
      .all()
      .map((row) => ({ ...row })),
    [
      {
        selection_id: 'selection-1',
        plant_id: 'plant-rose',
        change_kind: 'deleted',
        plant_name: 'Rose',
        baseline_json: null,
        photo_managed_filename: 'rose.png',
      },
      {
        selection_id: 'selection-2',
        plant_id: 'plant-rose',
        change_kind: 'deleted',
        plant_name: 'Rose',
        baseline_json: null,
        photo_managed_filename: 'rose.png',
      },
    ],
  );

  assert.deepEqual(repository.deletePlants(['plant-sage', 'missing']), {
    ok: false,
    code: 'plants_not_found',
  });
  assert.equal(
    database
      .prepare("SELECT count(*) AS count FROM plants WHERE id = 'plant-sage'")
      .get().count,
    1,
  );
});

test('filters by soil without requiring exposure or bloom filters', async (t) => {
  const repository = createCatalog(t);
  const result = await repository.list({
    offset: 0,
    limit: 25,
    filters: {
      soils: ['Humide'],
    },
  });

  assert.equal(result.total, 1);
  assert.deepEqual(plantNames(result), ['Achillée']);
});

test('filters by exposure without requiring soil or bloom filters', async (t) => {
  const repository = createCatalog(t);
  const result = await repository.list({
    offset: 0,
    limit: 25,
    filters: {
      exposures: ['shade'],
    },
  });

  assert.equal(result.total, 1);
  assert.deepEqual(plantNames(result), ['Achillée']);
});

test('filters by non-cyclic bloom month without relation filters', async (t) => {
  const repository = createCatalog(t);
  const result = await repository.list({
    offset: 0,
    limit: 30,
    filters: {
      bloomMonths: [6],
    },
  });

  assert.equal(result.total, 29);
  assert.equal(result.items.length, 29);
  assert.ok(!plantNames(result).includes('Achillée'));
});

test('filters by cyclic bloom month without relation filters', async (t) => {
  const repository = createCatalog(t);
  const result = await repository.list({
    offset: 0,
    limit: 25,
    filters: {
      bloomMonths: [1],
    },
  });

  assert.equal(result.total, 1);
  assert.deepEqual(plantNames(result), ['Achillée']);
});

test('filters by one flower color', async (t) => {
  const repository = createCatalog(t);
  const result = await repository.list({
    offset: 0,
    limit: 25,
    filters: {
      flowerColors: ['Blanc'],
    },
  });

  assert.equal(result.total, 1);
  assert.deepEqual(plantNames(result), ['Échinacée']);
});

test('uses OR between flower colors and avoids duplicate plants', async (t) => {
  const repository = createCatalog(t);
  const result = await repository.list({
    offset: 0,
    limit: 30,
    filters: {
      flowerColors: ['Blanc', 'Rose'],
    },
  });

  assert.equal(result.total, 29);
  assert.equal(result.items.length, 29);
  assert.equal(new Set(result.items.map(({ id }) => id)).size, 29);
  assert.ok(!plantNames(result).includes('Achillée'));
});

test('combines flower colors with other filter attributes', async (t) => {
  const repository = createCatalog(t);
  const result = await repository.list({
    offset: 0,
    limit: 25,
    filters: {
      soils: ['Humide'],
      exposures: ['shade'],
      bloomMonths: [1],
      flowerColors: ['Rose', 'Violet'],
    },
  });

  assert.equal(result.total, 1);
  assert.deepEqual(plantNames(result), ['Achillée']);
});

test('filters by soil, exposure, and cyclic bloom months', async (t) => {
  const repository = createCatalog(t);
  const result = await repository.list({
    offset: 0,
    limit: 25,
    filters: {
      soils: ['Humide'],
      exposures: ['shade'],
      bloomMonths: [1],
    },
  });

  assert.equal(result.total, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, 'Achillée');
});

test('uses OR inside one filter category and AND between categories', async (t) => {
  const repository = createCatalog(t);
  const result = await repository.list({
    offset: 0,
    limit: 25,
    filters: {
      soils: ['Humide', 'Drainé'],
      exposures: ['shade'],
    },
  });

  assert.equal(result.total, 1);
  assert.equal(result.items[0].name, 'Achillée');
});

test('lists every plant id matching the active filters', async (t) => {
  const repository = createCatalog(t);

  const allIds = await repository.listIds();
  const shadeIds = await repository.listIds({ exposures: ['shade'] });
  const roseIds = await repository.listIds({ flowerColors: ['Rose'] });

  assert.equal(allIds.length, 30);
  assert.deepEqual(allIds.slice(0, 2), ['plant-01', 'plant-00']);
  assert.deepEqual(shadeIds, ['plant-01']);
  assert.equal(roseIds.length, 29);
  assert.ok(!roseIds.includes('plant-01'));
});

test('lists catalog filter options from stored values', async (t) => {
  const repository = createCatalog(t);
  const options = await repository.listFilterOptions();

  assert.deepEqual(options.soils, ['Drainé', 'Humide']);
  assert.deepEqual(options.exposures, ['sun', 'shade']);
  assert.deepEqual(options.flowerColors, ['Blanc', 'Rose', 'Violet']);
  const wrapStart = options.bloomMonths.indexOf(11);
  assert.deepEqual(options.bloomMonths.slice(wrapStart), [11, 12, 1, 2]);
});
