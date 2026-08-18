const assert = require('node:assert/strict');
const test = require('node:test');
const { CatalogQueries } = require('../dist/catalog-queries');
const { createDatabase, insertPlant } = require('./database-test-helpers.cjs');

test('catalog-queries paginates ordered scalar rows', (t) => {
  const database = createDatabase(t);
  insertPlant(database, 'plant-c', 'Camélia', 'camelia');
  insertPlant(database, 'plant-a', 'Achillée', 'achillee');
  insertPlant(database, 'plant-b', 'Bégonia', 'begonia');
  const queries = new CatalogQueries(database);

  assert.equal(queries.total(), 3);
  assert.deepEqual(
    queries.page(1, 1).map(({ id }) => id),
    ['plant-b'],
  );
  assert.deepEqual(queries.ids(), ['plant-a', 'plant-b', 'plant-c']);
});

test('catalog-queries keeps pagination when filters add joins', (t) => {
  const database = createDatabase(t);
  insertPlant(database, 'plant-a', 'Achillée', 'achillee');
  insertPlant(database, 'plant-b', 'Bégonia', 'begonia');
  const soil = database
    .prepare(
      `INSERT INTO referential_soil_types
         (label, normalized_label, created_at)
       VALUES ('Humide', 'humide', '2026-08-15') RETURNING id`,
    )
    .get();
  database
    .prepare('INSERT INTO plant_soils (plant_id, soil_type_id) VALUES (?, ?)')
    .run('plant-b', soil.id);
  const queries = new CatalogQueries(database);

  assert.equal(queries.total({ soils: ['Humide'] }), 1);
  assert.deepEqual(
    queries.page(1, 0, { soils: ['Humide'] }).map(({ id }) => id),
    ['plant-b'],
  );
});
