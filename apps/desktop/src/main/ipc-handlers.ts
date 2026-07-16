import { rmSync } from 'node:fs';
import { join } from 'node:path';
import type {
  CatalogImportError,
  CatalogImportResult,
  PlantCatalogRepository,
  SelectionCreationInput,
  SelectionRepository,
} from '@my-little-garden/core';
import type { IpcMain } from 'electron';
import type { DatabaseSync } from 'node:sqlite';
import {
  replaceCatalogFromCsv,
  validateCatalogCsvStructure,
} from './catalog-import.js';
import { listCatalogPage, listSelectionSummaries } from './catalog-view.js';
import { deletePlantPhoto, importPlantPhotos } from './photo-import.js';

export interface IpcHandlerDependencies {
  readonly ipcMain: IpcMain;
  readonly database: DatabaseSync;
  readonly photoDirectory: string;
  readonly catalogRepository: PlantCatalogRepository;
  readonly selectionRepository: SelectionRepository;
}

export function registerIpcHandlers({
  ipcMain,
  database,
  photoDirectory,
  catalogRepository,
  selectionRepository,
}: IpcHandlerDependencies): void {
  ipcMain.handle('catalog:list', (_event, page: number, filters) =>
    listCatalogPage(catalogRepository, page, filters),
  );
  ipcMain.handle('catalog:list-ids', (_event, filters) =>
    catalogRepository.listIds(filters),
  );
  ipcMain.handle('catalog:filter-options', () =>
    catalogRepository.listFilterOptions(),
  );
  ipcMain.handle('selections:list', () =>
    listSelectionSummaries(selectionRepository),
  );
  ipcMain.handle('selections:create', (_event, input: SelectionCreationInput) =>
    selectionRepository.create(input),
  );
  ipcMain.handle(
    'catalog:replace',
    (_event, filename: string, csv: string): CatalogImportResult =>
      replaceCatalog(database, photoDirectory, filename, csv),
  );
  ipcMain.handle('photos:import', (_event, files) =>
    importPlantPhotos(database, photoDirectory, files),
  );
  ipcMain.handle('photos:delete', (_event, plantId: string) =>
    deletePlantPhoto(database, photoDirectory, plantId),
  );
}

function replaceCatalog(
  database: DatabaseSync,
  photoDirectory: string,
  filename: string,
  csv: string,
): CatalogImportResult {
  const errors = validateCatalogReplacement(filename, csv);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  try {
    const obsoletePhotos = database
      .prepare('SELECT managed_filename FROM plant_photos')
      .all()
      .map((row) => String(row.managed_filename));
    const imported = replaceCatalogFromCsv(database, csv);
    for (const filename of obsoletePhotos) {
      rmSync(join(photoDirectory, filename), { force: true });
    }
    return { ok: true, imported };
  } catch (error) {
    return {
      ok: false,
      errors: [
        {
          code: 'catalog_replacement_failed',
          message:
            error instanceof Error
              ? error.message
              : "Le catalogue n'a pas pu être remplacé.",
        },
      ],
    };
  }
}

function validateCatalogReplacement(
  filename: string,
  csv: string,
): CatalogImportError[] {
  const errors: CatalogImportError[] = [];
  if (!/\.csv$/iu.test(filename)) {
    errors.push({
      code: 'invalid_file_type',
      field: 'file',
      message:
        "Le fichier n'a pas le bon format. Merci d'importer les données à l'aide d'un fichier .csv. Ce format peut être généré à partir d'un tableur Excel, Google Sheets, etc.",
    });
  }
  if (typeof csv !== 'string') {
    return [
      {
        code: 'invalid_csv',
        message: 'Le contenu du fichier CSV est invalide.',
      },
    ];
  }
  errors.push(...validateCatalogCsvStructure(csv));
  return errors;
}
