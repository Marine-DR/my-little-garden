import {
  SqlitePlantCatalogRepository,
  SqliteSelectionRepository,
} from '@my-little-garden/database';
import { app, BrowserWindow, ipcMain } from 'electron';
import type { DatabaseSync } from 'node:sqlite';
import { seedDemoCatalog } from './catalog-import.js';
import {
  applicationPhotoDirectory,
  openApplicationDatabase,
  seedDemoCatalogIfNeeded,
} from './database.js';
import { registerApplicationHandlers } from './ipc/application-handlers.js';
import { registerCatalogHandlers } from './ipc/catalog-handlers.js';
import { registerCatalogManagementHandlers } from './ipc/catalog-management-handlers.js';
import { registerPhotoHandlers } from './ipc/photo-handlers.js';
import { registerSelectionHandlers } from './ipc/selection-handlers.js';
import { handlePhotoRequests, registerPhotoScheme } from './photo-protocol.js';
import { configureRuntimeEnvironment } from './runtime-environments/index.js';
import { createMainWindow } from './window.js';

configureRuntimeEnvironment(app);
registerPhotoScheme();

let database: DatabaseSync | undefined;

app.whenReady().then(async () => {
  const openedDatabase = openApplicationDatabase(app);
  database = openedDatabase;
  const photoDirectory = applicationPhotoDirectory(app);
  const catalogRepository = new SqlitePlantCatalogRepository(openedDatabase);
  const selectionRepository = new SqliteSelectionRepository(
    openedDatabase,
    catalogRepository,
  );
  seedDemoCatalogIfNeeded(app, (csv) => seedDemoCatalog(openedDatabase, csv));

  handlePhotoRequests(photoDirectory);
  registerApplicationHandlers(ipcMain, app.getVersion());
  registerCatalogHandlers(ipcMain, catalogRepository);
  registerSelectionHandlers(ipcMain, selectionRepository);
  registerCatalogManagementHandlers(ipcMain, openedDatabase, photoDirectory);
  registerPhotoHandlers(ipcMain, openedDatabase, photoDirectory);
  await createMainWindow(app);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow(app);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => database?.close());
