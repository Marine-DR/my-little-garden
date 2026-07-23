// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readCatalogCsvTemplate } from '@my-little-garden/communication';
import { SqlitePlantCatalogRepository } from '@my-little-garden/database';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  replaceCatalogFromCsv,
  seedDemoCatalog,
  validateCatalogCsvStructure,
} from '../src/main/catalog-import';

const initialMigration = readFileSync(
  resolve('packages/database/migrations/001_initial_schema.sql'),
  'utf8',
);
const demoCsv = readFileSync(
  resolve('apps/desktop/resources/demo-catalog.csv'),
  'utf8',
);
const catalogTemplate = readCatalogCsvTemplate();
let database: DatabaseSync | undefined;

afterEach(() => {
  database?.close();
  database = undefined;
});

describe('demo catalog', () => {
  it('keeps the downloadable template compatible with catalog replacement', () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec('PRAGMA foreign_keys = ON');

    expect(replaceCatalogFromCsv(database, catalogTemplate)).toBe(67);
  });

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

  it('imports empty and N/A heights including plants with only a maximum height', async () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec('PRAGMA foreign_keys = ON');
    const header = demoCsv.split(/\r?\n/u)[0];
    const csv = `${header}
Hauteur max,,120,Vivace,Fleur,Drainé,Soleil,Mars,Avril,Rose,Vert,-5,oui,15,printemps
Sans hauteur,N/A,N/A,Vivace,Fleur,Drainé,Soleil,Mars,Avril,Rose,Vert,-5,oui,15,printemps
`;

    expect(validateCatalogCsvStructure(csv)).toEqual([]);
    expect(replaceCatalogFromCsv(database, csv)).toBe(2);

    const catalog = await new SqlitePlantCatalogRepository(database).list({
      offset: 0,
      limit: 25,
    });
    expect(
      catalog.items.find(({ name }) => name === 'Hauteur max')?.heightCm,
    ).toEqual({ min: null, max: 120 });
    expect(
      catalog.items.find(({ name }) => name === 'Sans hauteur')?.heightCm,
    ).toBeNull();
  });

  it('reports an empty file without changing the current catalog', () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec('PRAGMA foreign_keys = ON');
    seedDemoCatalog(database, demoCsv);

    expect(() => replaceCatalogFromCsv(database!, '  \n')).toThrow(
      'Le fichier est vide',
    );
    expect(
      database.prepare('SELECT count(*) AS total FROM plants').get()?.total,
    ).toBe(4);
  });

  it('reports missing, unsupported, and excess columns together', () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec('PRAGMA foreign_keys = ON');
    seedDemoCatalog(database, demoCsv);
    const lines = demoCsv.split(/\r?\n/u);
    const invalidHeader = lines[0]!
      .replace('Sol', 'Terrain')
      .replace('Floraison Fin,', '')
      .concat(',Colonne en trop,Encore une');
    const invalidCsv = `${invalidHeader}\n${lines[1]},x,y\n`;

    expect(() => replaceCatalogFromCsv(database!, invalidCsv)).toThrowError(
      expect.objectContaining({
        message: expect.stringMatching(
          /La colonne Sol n'est pas présente[\s\S]*La colonne Floraison Fin n'est pas présente[\s\S]*La colonne Terrain présente[\s\S]*Il y a plus de colonne qu'attendu/u,
        ),
      }),
    );
    expect(
      database.prepare('SELECT count(*) AS total FROM plants').get()?.total,
    ).toBe(4);
  });

  it('accepts the exact supported header without structural errors', () => {
    expect(validateCatalogCsvStructure(demoCsv)).toEqual([]);
  });

  it('accepts column names regardless of letter case', () => {
    const caseVariant = demoCsv.replace('Floraison Fin', 'floraison fin');
    expect(validateCatalogCsvStructure(caseVariant)).toEqual([]);
  });

  it('reports every invalid number and unsupported controlled value together', () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec('PRAGMA foreign_keys = ON');
    seedDemoCatalog(database, demoCsv);
    const invalidCsv = demoCsv
      .replace('Achilée Ornementale,50,80', 'Achilée Ornementale,haute,80.5')
      .replace('Soleil|mi-ombre', 'Lumière')
      .replace(
        ',-10,oui,40,printemps|automne',
        ',froid,toujours,large,mousson',
      );

    const errors = validateCatalogCsvStructure(invalidCsv);
    expect(errors).toHaveLength(7);
    const messages = errors.map(({ message }) => message).join('\n');
    expect(messages).toMatch(/paramètre Taille min/u);
    expect(messages).toMatch(/paramètre Taille Max/u);
    expect(messages).toMatch(/paramètre T° min \(°C\)/u);
    expect(messages).toMatch(/paramètre Espace\(cm\)/u);
    expect(messages).toMatch(/colonne Exposition/u);
    expect(messages).toMatch(/colonne Feuillage persistant/u);
    expect(messages).toMatch(/colonne Plantation/u);
    expect(() => replaceCatalogFromCsv(database!, invalidCsv)).toThrow();
    expect(
      database.prepare('SELECT count(*) AS total FROM plants').get()?.total,
    ).toBe(4);
  });

  it('accepts every controlled value including accented and plain summer', () => {
    const header = demoCsv.split(/\r?\n/u)[0];
    const csv = `${header}\nTest,1,2,Vivace,Fleur,Drainé,Soleil|mi-ombre|Ombre,Mai,Juin,Rose,Vert,-5,oui,10,Printemps|Été|Eté|Automne|Hiver\n`;
    expect(validateCatalogCsvStructure(csv)).toEqual([]);
  });
});
