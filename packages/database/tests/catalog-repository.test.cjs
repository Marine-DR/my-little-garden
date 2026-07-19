const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const { SqlitePlantCatalogRepository } = require('../dist');

const migration = [
  '001_initial_schema.sql',
  '002_remove_selection_normalized_name.sql',
]
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

  assert.equal(allIds.length, 30);
  assert.deepEqual(allIds.slice(0, 2), ['plant-01', 'plant-00']);
  assert.deepEqual(shadeIds, ['plant-01']);
});

test('lists catalog filter options from stored values', async (t) => {
  const repository = createCatalog(t);
  const options = await repository.listFilterOptions();

  assert.deepEqual(options.soils, ['Drainé', 'Humide']);
  assert.deepEqual(options.exposures, ['sun', 'shade']);
  const wrapStart = options.bloomMonths.indexOf(11);
  assert.deepEqual(options.bloomMonths.slice(wrapStart), [11, 12, 1, 2]);
});
