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
import { createDesktopApi } from './desktop-api.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { handlePhotoRequests, registerPhotoScheme } from './photo-protocol.js';
import { createMainWindow } from './window.js';

if (
  process.platform === 'linux' &&
  process.env.XDG_SESSION_TYPE === 'wayland'
) {
  app.disableHardwareAcceleration();
}

registerPhotoScheme();

let database: DatabaseSync | undefined;

app.whenReady().then(async () => {
  const openedDatabase = openApplicationDatabase(app);
  database = openedDatabase;
  const photoDirectory = applicationPhotoDirectory(app);
  const catalogRepository = new SqlitePlantCatalogRepository(openedDatabase);
  const selectionRepository = new SqliteSelectionRepository(openedDatabase);
  seedDemoCatalogIfNeeded(app, (csv) => seedDemoCatalog(openedDatabase, csv));

  handlePhotoRequests(photoDirectory);
  registerIpcHandlers({
    ipcMain,
    desktopApi: createDesktopApi({
      database: openedDatabase,
      photoDirectory,
      catalogRepository,
      selectionRepository,
    }),
  });
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
