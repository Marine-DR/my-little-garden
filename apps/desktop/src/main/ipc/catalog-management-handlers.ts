import type { IpcMain } from 'electron';
import type { DatabaseSync } from 'node:sqlite';
import { CsvPlantCatalogImporter } from '@my-little-garden/communication';
import { CatalogDeletionService } from '@my-little-garden/core';
import { SqlitePlantCatalogRepository } from '@my-little-garden/database';
import { CATALOG_MANAGEMENT_CHANNELS } from '../../shared/catalog-management-service.js';
import { replaceCatalog } from '../catalog-replacement.js';
import { CatalogAdditionService } from '../catalog-addition.js';
import { CatalogModificationImportService } from '../catalog-modification.js';

export function registerCatalogManagementHandlers(
  ipcMain: IpcMain,
  database: DatabaseSync,
  photoDirectory: string,
  catalogTemplate: string,
): void {
  const addition = new CatalogAdditionService(
    new SqlitePlantCatalogRepository(database),
    new CsvPlantCatalogImporter(),
  );
  const modification = new CatalogModificationImportService(
    new SqlitePlantCatalogRepository(database),
    new CsvPlantCatalogImporter(),
  );
  const deletion = new CatalogDeletionService(
    new SqlitePlantCatalogRepository(database),
  );
  ipcMain.handle(CATALOG_MANAGEMENT_CHANNELS.template, () => catalogTemplate);
  ipcMain.handle(
    CATALOG_MANAGEMENT_CHANNELS.replace,
    (_event, filename: string, csv: string) =>
      replaceCatalog(database, photoDirectory, filename, csv),
  );
  ipcMain.handle(
    CATALOG_MANAGEMENT_CHANNELS.addPreview,
    (_event, filename: string, csv: string) => addition.preview(filename, csv),
  );
  ipcMain.handle(
    CATALOG_MANAGEMENT_CHANNELS.addCommit,
    (_event, token: string, policy: 'update_existing' | 'ignore_existing') =>
      addition.commit(token, policy),
  );
  ipcMain.handle(
    CATALOG_MANAGEMENT_CHANNELS.modifyPreview,
    (_event, filename: string, csv: string) =>
      modification.preview(filename, csv),
  );
  ipcMain.handle(
    CATALOG_MANAGEMENT_CHANNELS.modifyCommit,
    (_event, token: string, policy: 'create_missing' | 'ignore_missing') =>
      modification.commit(token, policy),
  );
  ipcMain.handle(
    CATALOG_MANAGEMENT_CHANNELS.deletePreview,
    (_event, plantIds: readonly string[]) => deletion.preview(plantIds),
  );
  ipcMain.handle(
    CATALOG_MANAGEMENT_CHANNELS.deleteCommit,
    (_event, plantIds: readonly string[]) => deletion.delete(plantIds),
  );
}
