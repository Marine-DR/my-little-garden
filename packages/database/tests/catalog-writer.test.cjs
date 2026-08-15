const assert = require('node:assert/strict');
const test = require('node:test');
const { CatalogWriter } = require('../dist/catalog-writer');
const { createDatabase } = require('./database-test-helpers.cjs');

function plantInput(overrides = {}) {
  return {
    id: 'plant-rose',
    name: 'Rosier ancien',
    heightCm: { min: 80, max: 120 },
    typeLabel: 'Arbuste',
    kindLabels: ['Fleur'],
    soilLabels: ['Drainé'],
    exposures: ['sun'],
    bloom: { startMonth: 5, endMonth: 9 },
    flowerColorLabels: ['Rose'],
    leafColorLabels: ['Vert'],
    minimumTemperatureCelsius: -15,
    foliagePersistence: 'deciduous',
    spacingCm: 60,
    plantingSeasons: ['autumn'],
    photo: null,
    ...overrides,
  };
}

test('catalog-writer upserts scalar fields and replaces every relation', (t) => {
  const database = createDatabase(t);
  const writer = new CatalogWriter(database);
  const created = plantInput();
  writer.upsertPlant(created, '2026-08-15T10:00:00.000Z');
  writer.replaceRelations(created);

  assert.deepEqual(
    { ...database.prepare('SELECT name, normalized_name FROM plants').get() },
    { name: 'Rosier ancien', normalized_name: 'rosier ancien' },
  );
  assert.equal(
    database.prepare('SELECT count(*) AS total FROM plant_soils').get().total,
    1,
  );

  const updated = plantInput({
    name: 'Rosier grimpant',
    soilLabels: ['Humide'],
    flowerColorLabels: [],
  });
  writer.upsertPlant(updated, '2026-08-15T11:00:00.000Z');
  writer.replaceRelations(updated);

  assert.equal(
    database.prepare('SELECT name FROM plants').get().name,
    'Rosier grimpant',
  );
  assert.deepEqual(
    database
      .prepare(
        `SELECT soil.label FROM plant_soils relation
         JOIN referential_soil_types soil ON soil.id = relation.soil_type_id`,
      )
      .all()
      .map(({ label }) => label),
    ['Humide'],
  );
  assert.equal(
    database.prepare('SELECT count(*) AS total FROM plant_flower_colors').get()
      .total,
    0,
  );
});
