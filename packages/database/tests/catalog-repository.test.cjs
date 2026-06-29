const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const test = require('node:test');
const { SqlitePlantCatalogRepository } = require('../dist');

const migration = readFileSync(
  join(__dirname, '..', 'migrations', '001_initial_schema.sql'),
  'utf8',
);

function createCatalog(t) {
  const database = new DatabaseSync(':memory:');
  database.exec(migration);
  t.after(() => database.close());
  const plant = database.prepare(`INSERT INTO plants (
    id, name, normalized_name, bloom_start_month, bloom_end_month,
    created_at, updated_at
  ) VALUES (?, ?, ?, 5, 9, '2026-06-28', '2026-06-28')`);
  const soil = database.prepare(`
    INSERT INTO soil_types (label, normalized_label, created_at)
    VALUES ('Drainé', 'draine', '2026-06-28') RETURNING id
  `).get();
  for (let index = 0; index < 30; index += 1) {
    const suffix = String(index).padStart(2, '0');
    const id = `plant-${suffix}`;
    const name = index === 0
      ? 'Échinacée'
      : index === 1
        ? 'Achillée'
        : `Plante ${suffix}`;
    const normalized = index === 0
      ? 'echinacee'
      : index === 1
        ? 'achillee'
        : `plante ${suffix}`;
    plant.run(id, name, normalized);
    database.prepare(
      'INSERT INTO plant_soils (plant_id, soil_type_id) VALUES (?, ?)',
    ).run(id, Number(soil.id));
    database.prepare(`
      INSERT INTO plant_exposures (plant_id, exposure_code) VALUES (?, 'sun')
    `).run(id);
  }
  return new SqlitePlantCatalogRepository(database);
}

test('lists one alphabetically sorted domain plant per name', async (t) => {
  const repository = createCatalog(t);
  const result = await repository.list({ offset: 0, limit: 25 });

  assert.equal(result.total, 30);
  assert.equal(result.items.length, 25);
  assert.equal(result.items[0].name, 'Achillée');
  assert.deepEqual(result.items[0].soils, [{ id: 1, label: 'Drainé' }]);
  assert.deepEqual(result.items[0].exposures, ['sun']);
  assert.equal(new Set(result.items.map(({ name }) => name)).size, 25);
});

test('uses offset and limit for subsequent pages', async (t) => {
  const repository = createCatalog(t);
  const result = await repository.list({ offset: 25, limit: 25 });

  assert.equal(result.total, 30);
  assert.equal(result.items.length, 5);
});
