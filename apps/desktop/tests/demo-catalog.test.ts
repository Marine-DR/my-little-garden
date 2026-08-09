// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CsvPlantCatalogImporter,
  readCatalogCsvTemplate,
} from '@my-little-garden/communication';
import {
  databaseMigrationFilenames,
  SqlitePlantCatalogRepository,
} from '@my-little-garden/database';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import {
  replaceCatalogFromCsv,
  seedDemoCatalog,
  validateCatalogCsvStructure,
} from '../src/main/catalog-import';
import { CatalogAdditionService } from '../src/main/catalog-addition';
import { CatalogModificationImportService } from '../src/main/catalog-modification';

const initialMigration = databaseMigrationFilenames
  .map((filename) =>
    readFileSync(resolve('packages/database/migrations', filename), 'utf8'),
  )
  .join('\n');
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
  it('preserves multiple Fleur/autre values separated by pipes', () => {
    const header = catalogTemplate.split(/\r?\n/u)[0];
    const result = new CsvPlantCatalogImporter().importData(
      `${header}\n,Pivoine,60,90,Vivace,Fleur|Arbuste,Drainé,Soleil,Mai,Juin,Rose,Vert,-15,non,60,automne`,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.records[0]?.plant.kindLabels).toEqual(['Fleur', 'Arbuste']);
    }
  });

  it('modifies existing plants, ignores identical records, and resolves missing plants', async () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec('PRAGMA foreign_keys = ON');
    seedDemoCatalog(database, demoCsv);
    const lines = demoCsv.split(/\r?\n/u);
    const csv = `${lines[0]}\n${lines[1]?.replace(',50,80,', ',25,80,')}\nNouvelle fleur,10,20,Vivace,Fleur,Drainé,Soleil,Mars,Avril,Rose,Vert,-5,oui,15,printemps\n`;
    const service = new CatalogModificationImportService(
      new SqlitePlantCatalogRepository(database),
      new CsvPlantCatalogImporter(),
    );
    const preview = await service.preview('modification.csv', csv);
    expect(preview).toMatchObject({
      ok: true,
      updated: 1,
      unchanged: 0,
      missing: ['Nouvelle fleur'],
    });
    if (!preview.ok) {
      throw new Error('Preview should succeed');
    }
    expect(service.commit(preview.token, 'ignore_missing')).toEqual({
      ok: true,
      created: 0,
      updated: 1,
      ignored: 1,
      unchanged: 0,
      notAdded: 1,
    });
    const catalog = await new SqlitePlantCatalogRepository(database).list({
      offset: 0,
      limit: 25,
    });
    expect(catalog.total).toBe(4);
    expect(
      catalog.items.find(({ name }) => name === 'Achilée Ornementale')
        ?.heightCm,
    ).toEqual({ min: 25, max: 80 });

    const createPreview = await service.preview('modification.csv', csv);
    if (!createPreview.ok) {
      throw new Error('Preview should succeed');
    }
    expect(service.commit(createPreview.token, 'create_missing')).toMatchObject(
      {
        ok: true,
        created: 1,
        updated: 0,
        unchanged: 1,
        notAdded: 0,
      },
    );
  });

  it('adds new plants, ignores identical plants, and updates conflicts on request', async () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec('PRAGMA foreign_keys = ON');
    seedDemoCatalog(database, demoCsv);
    const lines = demoCsv.split(/\r?\n/u);
    const csv = `${lines[0]}\n${lines[1]}\nAster,10,20,Vivace,Fleur,Drainé,Soleil,Mars,Avril,Rose,Vert,-5,oui,15,printemps\n`;
    const service = new CatalogAdditionService(
      new SqlitePlantCatalogRepository(database),
      new CsvPlantCatalogImporter(),
    );
    const preview = await service.preview('ajout.csv', csv);
    expect(preview).toMatchObject({
      ok: true,
      created: 1,
      unchanged: 1,
      conflicts: [],
    });
    if (!preview.ok) {
      throw new Error('Preview should succeed');
    }
    expect(await service.commit(preview.token, 'ignore_existing')).toEqual({
      ok: true,
      created: 1,
      updated: 0,
      ignored: 1,
      alreadyExisted: 1,
      notAdded: 0,
    });

    const updateCsv = csv.replace('Aster,10,20', 'Aster,20,30');
    const updatePreview = await service.preview('ajout.csv', updateCsv);
    expect(updatePreview).toMatchObject({ ok: true, conflicts: ['Aster'] });
    if (!updatePreview.ok) {
      throw new Error('Preview should succeed');
    }
    expect(
      await service.commit(updatePreview.token, 'update_existing'),
    ).toEqual({
      ok: true,
      created: 0,
      updated: 1,
      ignored: 1,
      alreadyExisted: 1,
      notAdded: 0,
    });
    const catalog = await new SqlitePlantCatalogRepository(database).list({
      offset: 0,
      limit: 25,
    });
    expect(
      catalog.items.find(({ name }) => name === 'Aster')?.heightCm,
    ).toEqual({ min: 20, max: 30 });
  });

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

  it('preserves selection links by normalized name and records replacement impacts', () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec('PRAGMA foreign_keys = ON');
    seedDemoCatalog(database, demoCsv);
    const achillee = database
      .prepare("SELECT id FROM plants WHERE name = 'Achilée Ornementale'")
      .get();
    const pavot = database
      .prepare("SELECT id FROM plants WHERE normalized_name = 'pavot'")
      .get();
    database
      .prepare(
        `INSERT INTO selections (id, name, created_at, updated_at)
         VALUES ('selection-1', 'Massif', '2026-08-01', '2026-08-01')`,
      )
      .run();
    const link = database.prepare(
      `INSERT INTO selection_plants (selection_id, plant_id, added_at)
       VALUES ('selection-1', ?, '2026-08-01')`,
    );
    link.run(String(achillee?.id));
    link.run(String(pavot?.id));
    const lines = demoCsv.split(/\r?\n/u);
    const replacement = `${lines[0]}\n${lines[1]?.replace(',50,80,', ',25,80,')}\n`;

    expect(replaceCatalogFromCsv(database, replacement)).toBe(1);
    expect(
      database
        .prepare('SELECT plant_id FROM selection_plants')
        .all()
        .map(({ plant_id }) => plant_id),
    ).toEqual([achillee?.id]);
    expect(
      database
        .prepare(
          `SELECT plant_id, change_kind FROM selection_plant_changes
           ORDER BY change_kind`,
        )
        .all()
        .map(({ plant_id, change_kind }) => ({ plant_id, change_kind })),
    ).toEqual([
      { plant_id: pavot?.id, change_kind: 'deleted' },
      { plant_id: achillee?.id, change_kind: 'modified' },
    ]);
  });

  it('renames by UUID while preserving the stable id and selection link', () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec('PRAGMA foreign_keys = ON');
    seedDemoCatalog(database, demoCsv);
    const plant = database
      .prepare("SELECT id FROM plants WHERE name = 'Achilée Ornementale'")
      .get();
    database
      .prepare(
        `INSERT INTO selections (id, name, created_at, updated_at)
         VALUES ('selection-1', 'Massif', '2026-08-01', '2026-08-01')`,
      )
      .run();
    database
      .prepare(
        `INSERT INTO selection_plants (selection_id, plant_id, added_at)
         VALUES ('selection-1', ?, '2026-08-01')`,
      )
      .run(String(plant?.id));
    const lines = demoCsv.split(/\r?\n/u);
    const replacement = `plant_id,${lines[0]}\n${plant?.id},${lines[1]?.replace('Achilée Ornementale', 'Achillée renommée')}\n`;

    expect(replaceCatalogFromCsv(database, replacement)).toBe(1);
    expect(database.prepare('SELECT id, name FROM plants').get()).toMatchObject(
      { id: plant?.id, name: 'Achillée renommée' },
    );
    expect(
      database.prepare('SELECT plant_id FROM selection_plants').get(),
    ).toMatchObject({ plant_id: plant?.id });
    expect(
      database.prepare('SELECT change_kind FROM selection_plant_changes').get(),
    ).toMatchObject({ change_kind: 'modified' });
  });

  it('treats a rename without UUID as deletion plus creation', () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec('PRAGMA foreign_keys = ON');
    const lines = demoCsv.split(/\r?\n/u);
    seedDemoCatalog(database, `${lines[0]}\n${lines[1]}\n`);
    const oldPlant = database.prepare('SELECT id FROM plants').get();
    database
      .prepare(
        `INSERT INTO selections (id, name, created_at, updated_at)
         VALUES ('selection-1', 'Massif', '2026-08-01', '2026-08-01')`,
      )
      .run();
    database
      .prepare(
        `INSERT INTO selection_plants (selection_id, plant_id, added_at)
         VALUES ('selection-1', ?, '2026-08-01')`,
      )
      .run(String(oldPlant?.id));
    const replacement = `${lines[0]}\n${lines[1]?.replace('Achilée Ornementale', 'Achillée renommée')}\n`;

    replaceCatalogFromCsv(database, replacement);
    const newPlant = database.prepare('SELECT id, name FROM plants').get();
    expect(newPlant).toMatchObject({ name: 'Achillée renommée' });
    expect(newPlant?.id).not.toBe(oldPlant?.id);
    expect(
      database.prepare('SELECT count(*) AS count FROM selection_plants').get()
        ?.count,
    ).toBe(0);
    expect(
      database
        .prepare('SELECT plant_id, change_kind FROM selection_plant_changes')
        .get(),
    ).toMatchObject({ plant_id: oldPlant?.id, change_kind: 'deleted' });
  });

  it('rolls back a replacement when UUID and name identify different plants', () => {
    database = new DatabaseSync(':memory:');
    database.exec(initialMigration);
    database.exec('PRAGMA foreign_keys = ON');
    seedDemoCatalog(database, demoCsv);
    const achillee = database
      .prepare("SELECT id FROM plants WHERE name = 'Achilée Ornementale'")
      .get();
    const lines = demoCsv.split(/\r?\n/u);
    const conflicting = `plant_id,${lines[0]}\n${achillee?.id},${lines[2]}\n`;

    expect(() => replaceCatalogFromCsv(database!, conflicting)).toThrow(
      /deux plantes différentes/u,
    );
    expect(
      database.prepare('SELECT count(*) AS count FROM plants').get()?.count,
    ).toBe(4);
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

  it('reports a specific error when spacing is negative', () => {
    const invalidCsv = demoCsv.replace(
      ',oui,40,printemps|automne',
      ',oui,-30,printemps|automne',
    );

    expect(validateCatalogCsvStructure(invalidCsv)).toContainEqual({
      code: 'invalid_spacing',
      field: 'Espace(cm)',
      message:
        'La valeur de la colonne Espace(cm) doit être un nombre entier positif ou nul.',
    });
  });

  it('accepts every controlled value including accented and plain summer', () => {
    const header = demoCsv.split(/\r?\n/u)[0];
    const csv = `${header}\nTest,1,2,Vivace,Fleur,Drainé,Soleil|mi-ombre|Ombre,Mai,Juin,Rose,Vert,-5,oui,10,Printemps|Été|Eté|Automne|Hiver\n`;
    expect(validateCatalogCsvStructure(csv)).toEqual([]);
  });
});
