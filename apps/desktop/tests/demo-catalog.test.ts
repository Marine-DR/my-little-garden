// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SqlitePlantCatalogRepository } from '@my-little-garden/database';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  replaceCatalogFromCsv,
  seedDemoCatalog,
} from '../src/main/demo-catalog';

const initialMigration = readFileSync(
  resolve('packages/database/migrations/001_initial_schema.sql'),
  'utf8',
);
const demoCsv = readFileSync(
  resolve('apps/desktop/resources/demo-catalog.csv'),
  'utf8',
);
let database: DatabaseSync | undefined;

afterEach(() => {
  database?.close();
  database = undefined;
});

describe('demo catalog', () => {
  it('imports all four CSV rows including plants with optional bloom and height', async () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec('PRAGMA foreign_keys = ON');

    expect(seedDemoCatalog(database, demoCsv)).toBe(4);
    const repository = new SqlitePlantCatalogRepository(database);
    const catalog = await repository.list({ offset: 0, limit: 25 });
    expect(catalog.items.map(({ name }) => name)).toEqual([
      'Achilée Ornementale',
      'Acorus',
      'Pavot',
      'Test',
    ]);

    const acorus = catalog.items.find(({ name }) => name === 'Acorus');
    expect(acorus?.bloom).toBeNull();

    const testPlant = catalog.items.find(({ name }) => name === 'Test');
    expect(testPlant?.heightCm).toEqual({ min: 42, max: null });

    const achillee = catalog.items.find(
      ({ name }) => name === 'Achilée Ornementale',
    );
    expect(achillee?.exposures).toEqual(['sun', 'partial_shade']);
  });

  it('rolls back the complete import when a mandatory relation is missing', () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec('PRAGMA foreign_keys = ON');
    const invalidCsv = demoCsv.replace(
      'Acorus,15,120,Vivace,Graminée,Lourd|humide,Soleil|mi-ombre',
      'Acorus,15,120,Vivace,Graminée,,Soleil|mi-ombre',
    );

    expect(() => seedDemoCatalog(database!, invalidCsv)).toThrow(/soilLabels/u);
    expect(
      database.prepare('SELECT count(*) AS total FROM plants').get()?.total,
    ).toBe(0);
  });

  it('keeps the current catalog when replacement validation fails', () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec('PRAGMA foreign_keys = ON');
    seedDemoCatalog(database, demoCsv);
    const invalidCsv = demoCsv.replace(
      'Acorus,15,120,Vivace,Graminée,Lourd|humide,Soleil|mi-ombre',
      'Acorus,15,120,Vivace,Graminée,,Soleil|mi-ombre',
    );

    expect(() => replaceCatalogFromCsv(database!, invalidCsv)).toThrow(
      /soilLabels/u,
    );
    expect(
      database.prepare('SELECT count(*) AS total FROM plants').get()?.total,
    ).toBe(4);
  });

  it('deletes the old catalog and imports every value in the replacement CSV', async () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec('PRAGMA foreign_keys = ON');
    seedDemoCatalog(database, demoCsv);
    const replacement = `${demoCsv.split(/\r?\n/u)[0]}\nNouvelle fleur,10,20,Vivace,Fleur,Sec|Drainé,Soleil|mi-ombre,Mars,Avril,Rose|Blanc,Vert,-5,oui,15,printemps|automne\n`;

    expect(replaceCatalogFromCsv(database, replacement)).toBe(1);
    const catalog = await new SqlitePlantCatalogRepository(database).list({
      offset: 0,
      limit: 25,
    });
    expect(catalog.total).toBe(1);
    expect(catalog.items[0]).toMatchObject({
      name: 'Nouvelle fleur',
      exposures: ['sun', 'partial_shade'],
      plantingSeasons: ['spring', 'autumn'],
    });
    expect(catalog.items[0]?.soils.map(({ label }) => label)).toEqual(
      expect.arrayContaining(['Sec', 'Drainé']),
    );
    expect(
      catalog.items[0]?.flowerColors.map(({ label }) =>
        label.toLocaleLowerCase('fr'),
      ),
    ).toEqual(expect.arrayContaining(['rose', 'blanc']));
  });
});
