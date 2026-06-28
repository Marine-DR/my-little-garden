// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { listCatalogPlants } from './catalog-repository';

const migration = readFileSync(resolve('packages/database/migrations/001_initial_schema.sql'), 'utf8');
let database: DatabaseSync | undefined;

function createCatalog(): DatabaseSync {
  database = new DatabaseSync(':memory:');
  database.exec(migration);
  const plant = database.prepare(`INSERT INTO plants (
    id, name, normalized_name, bloom_start_month, bloom_end_month, created_at, updated_at
  ) VALUES (?, ?, ?, 5, 9, '2026-06-28', '2026-06-28')`);
  const soil = database.prepare("INSERT INTO soil_types (label, normalized_label, created_at) VALUES ('Drainé', 'draine', '2026-06-28') RETURNING id").get()!;
  for (let index = 0; index < 30; index += 1) {
    const suffix = String(index).padStart(2, '0');
    const id = `plant-${suffix}`;
    const name = index === 0 ? 'Échinacée' : index === 1 ? 'Achillée' : `Plante ${suffix}`;
    const normalized = index === 0 ? 'echinacee' : index === 1 ? 'achillee' : `plante ${suffix}`;
    plant.run(id, name, normalized);
    database.prepare('INSERT INTO plant_soils (plant_id, soil_type_id) VALUES (?, ?)').run(id, Number(soil.id));
    database.prepare("INSERT INTO plant_exposures (plant_id, exposure_code) VALUES (?, 'sun')").run(id);
  }
  return database;
}

afterEach(() => { database?.close(); database = undefined; });

describe('listCatalogPlants', () => {
  it('returns one alphabetically sorted row per name and exactly 25 results', () => {
    const result = listCatalogPlants(createCatalog(), 1);
    expect(result.total).toBe(30);
    expect(result.items).toHaveLength(25);
    expect(result.items[0]?.name).toBe('Achillée');
    expect(result.items[0]?.soils).toEqual(['Drainé']);
    expect(result.items[0]?.exposures).toEqual(['sun']);
    expect(new Set(result.items.map((item) => item.name)).size).toBe(25);
  });

  it('returns the remaining results on page two', () => {
    const result = listCatalogPlants(createCatalog(), 2);
    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(5);
  });
});
