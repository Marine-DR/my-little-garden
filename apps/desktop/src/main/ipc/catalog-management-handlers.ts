import { CATALOG_CSV_TEMPLATE } from '@my-little-garden/communication';
import type { IpcMain } from 'electron';
import type { DatabaseSync } from 'node:sqlite';
import { CATALOG_MANAGEMENT_CHANNELS } from '../../shared/catalog-management-service.js';
import { replaceCatalog } from '../catalog-replacement.js';

export function registerCatalogManagementHandlers(
  ipcMain: IpcMain,
  database: DatabaseSync,
  photoDirectory: string,
): void {
  ipcMain.handle(
    CATALOG_MANAGEMENT_CHANNELS.template,
    () => CATALOG_CSV_TEMPLATE,
  );
  ipcMain.handle(
    CATALOG_MANAGEMENT_CHANNELS.replace,
    (_event, filename: string, csv: string) =>
      replaceCatalog(database, photoDirectory, filename, csv),
  );
}
