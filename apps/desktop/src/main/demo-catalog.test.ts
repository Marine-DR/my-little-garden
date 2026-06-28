// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { listCatalogPlants } from './catalog-repository';
import { seedDemoCatalog } from './demo-catalog';

const initialMigration = readFileSync(resolve('packages/database/migrations/001_initial_schema.sql'), 'utf8');
const optionalFieldsMigration = readFileSync(resolve('packages/database/migrations/002_optional_bloom_and_partial_height.sql'), 'utf8');
const demoCsv = readFileSync(resolve('apps/desktop/resources/demo-catalog.csv'), 'utf8');
let database: DatabaseSync | undefined;

afterEach(() => { database?.close(); database = undefined; });

describe('demo catalog', () => {
  it('imports all four CSV rows including plants with optional bloom and height', () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec(optionalFieldsMigration);
    database.exec('PRAGMA foreign_keys = ON');

    expect(seedDemoCatalog(database, demoCsv)).toBe(4);
    const catalog = listCatalogPlants(database, 1);
    expect(catalog.items.map(({ name }) => name)).toEqual([
      'Achilée Ornementale', 'Acorus', 'Pavot', 'Test',
    ]);

    const acorus = catalog.items.find(({ name }) => name === 'Acorus');
    expect(acorus?.bloomStartMonth).toBeNull();
    expect(acorus?.bloomEndMonth).toBeNull();

    const testPlant = catalog.items.find(({ name }) => name === 'Test');
    expect(testPlant?.heightMinCm).toBe(42);
    expect(testPlant?.heightMaxCm).toBeNull();

    const achillee = catalog.items.find(({ name }) => name === 'Achilée Ornementale');
    expect(achillee?.exposures).toEqual(['sun', 'partial_shade']);
  });
});

