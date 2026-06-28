import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { app, BrowserWindow, ipcMain, net, protocol } from 'electron';
import { listCatalogPlants } from './catalog-repository.js';
import { seedDemoCatalog } from './demo-catalog.js';

protocol.registerSchemesAsPrivileged([
  { scheme: 'garden-photo', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let database: DatabaseSync;

function ensureSchema(db: DatabaseSync): void {
  const hasPlants = db.prepare(
    "SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'plants'",
  ).get();
  const migrationDirectory = join(app.getAppPath(), 'packages', 'database', 'migrations');
  if (!hasPlants) {
    db.exec(readFileSync(join(migrationDirectory, '001_initial_schema.sql'), 'utf8'));
  }
  const version = Number(db.prepare('PRAGMA user_version').get()?.user_version ?? 0);
  if (version < 2) {
    db.exec(readFileSync(join(migrationDirectory, '002_optional_bloom_and_partial_height.sql'), 'utf8'));
  }
}

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    autoHideMenuBar: true,
    backgroundColor: '#f8faf7',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: join(app.getAppPath(), 'dist', 'main', 'preload', 'preload.js'),
    },
  });
  window.setMenu(null);

  await window.loadFile(join(app.getAppPath(), 'dist', 'renderer', 'index.html'));
}

app.whenReady().then(async () => {
  const demoMode = process.env.MY_LITTLE_GARDEN_DEMO === '1';
  const dataDirectory = app.getPath('userData');
  const photoDirectory = join(dataDirectory, 'images');
  database = new DatabaseSync(demoMode ? ':memory:' : join(dataDirectory, 'catalog.sqlite'));
  database.exec('PRAGMA foreign_keys = ON');
  ensureSchema(database);
  if (demoMode) {
    const csvPath = join(app.getAppPath(), 'apps', 'desktop', 'resources', 'demo-catalog.csv');
    seedDemoCatalog(database, readFileSync(csvPath, 'utf8'));
  }

  protocol.handle('garden-photo', (request) => {
    const filename = decodeURIComponent(new URL(request.url).pathname.slice(1));
    if (!filename || basename(filename) !== filename) {
      return new Response('Invalid image path', { status: 400 });
    }
    return net.fetch(pathToFileURL(join(photoDirectory, filename)).toString());
  });

  ipcMain.handle('catalog:list', (_event, page: number) => listCatalogPlants(database, page));
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => database?.close());
