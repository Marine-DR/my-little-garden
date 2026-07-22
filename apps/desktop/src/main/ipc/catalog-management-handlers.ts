import type { IpcMain } from 'electron';
import type { DatabaseSync } from 'node:sqlite';
import { CATALOG_MANAGEMENT_CHANNELS } from '../../shared/catalog-management-service.js';
import { replaceCatalog } from '../catalog-replacement.js';

export function registerCatalogManagementHandlers(
  ipcMain: IpcMain,
  database: DatabaseSync,
  photoDirectory: string,
  catalogTemplate: string,
): void {
  ipcMain.handle(CATALOG_MANAGEMENT_CHANNELS.template, () => catalogTemplate);
  ipcMain.handle(
    CATALOG_MANAGEMENT_CHANNELS.replace,
    (_event, filename: string, csv: string) =>
      replaceCatalog(database, photoDirectory, filename, csv),
  );
}
