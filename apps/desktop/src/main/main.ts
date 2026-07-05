import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Plant, PlantCatalogRepository } from '@my-little-garden/core';
import { SqlitePlantCatalogRepository } from '@my-little-garden/database';
import { DatabaseSync } from 'node:sqlite';
import { app, BrowserWindow, ipcMain, net, protocol } from 'electron';
import type { CatalogPage, CatalogPlant } from '../shared/catalog.js';
import { seedDemoCatalog } from './demo-catalog.js';

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'garden-photo',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

let database: DatabaseSync;
let catalogRepository: PlantCatalogRepository;
const CATALOG_PAGE_SIZE = 25;

function ensureSchema(db: DatabaseSync): void {
  const hasPlants = db
    .prepare(
      "SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'plants'",
    )
    .get();
  const migrationDirectory = join(
    app.getAppPath(),
    'packages',
    'database',
    'migrations',
  );
  if (!hasPlants) {
    db.exec(
      readFileSync(join(migrationDirectory, '001_initial_schema.sql'), 'utf8'),
    );
  }
}

function photoUrl(filename: string | null): string | null {
  if (!filename || basename(filename) !== filename) {
    return null;
  }
  return `garden-photo:///${encodeURIComponent(filename)}`;
}

function toCatalogPlant(plant: Plant): CatalogPlant {
  return {
    id: plant.id,
    name: plant.name,
    photoUrl: photoUrl(plant.photo?.managedFilename ?? null),
    heightMinCm: plant.heightCm?.min ?? null,
    heightMaxCm: plant.heightCm?.max ?? null,
    type: plant.type?.label ?? null,
    kind: plant.kind,
    soils: plant.soils.map(({ label }) => label),
    exposures: plant.exposures,
    bloomStartMonth: plant.bloom?.startMonth ?? null,
    bloomEndMonth: plant.bloom?.endMonth ?? null,
    flowerColors: plant.flowerColors.map(({ label }) => label),
    leafColors: plant.leafColors.map(({ label }) => label),
    minimumTemperatureCelsius: plant.minimumTemperatureCelsius,
    foliagePersistence: plant.foliagePersistence,
    spacingCm: plant.spacingCm,
    plantingSeasons: plant.plantingSeasons,
  };
}

async function listCatalogPage(requestedPage: number): Promise<CatalogPage> {
  const normalizedPage = Math.max(1, Math.trunc(requestedPage) || 1);
  let result = await catalogRepository.list({
    offset: (normalizedPage - 1) * CATALOG_PAGE_SIZE,
    limit: CATALOG_PAGE_SIZE,
  });
  const pageCount = Math.max(1, Math.ceil(result.total / CATALOG_PAGE_SIZE));
  const page = Math.min(normalizedPage, pageCount);
  if (page !== normalizedPage) {
    result = await catalogRepository.list({
      offset: (page - 1) * CATALOG_PAGE_SIZE,
      limit: CATALOG_PAGE_SIZE,
    });
  }
  return {
    items: result.items.map(toCatalogPlant),
    page,
    pageSize: CATALOG_PAGE_SIZE,
    total: result.total,
  };
}

function resolveRendererEntry(): {
  type: 'file' | 'url';
  path?: string;
  url?: string;
} {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    return { type: 'url', url: devServerUrl };
  }

  return {
    type: 'file',
    path: join(app.getAppPath(), 'dist', 'renderer', 'index.html'),
  };
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

  const entry = resolveRendererEntry();

  if (entry.type === 'url' && entry.url) {
    await window.loadURL(entry.url);
  } else if (entry.path) {
    await window.loadFile(entry.path);
  }
}

app.whenReady().then(async () => {
  const demoMode = process.env.MY_LITTLE_GARDEN_DEMO === '1';
  const dataDirectory = app.getPath('userData');
  const photoDirectory = join(dataDirectory, 'images');
  database = new DatabaseSync(
    demoMode ? ':memory:' : join(dataDirectory, 'catalog.sqlite'),
  );
  database.exec('PRAGMA foreign_keys = ON');
  ensureSchema(database);
  catalogRepository = new SqlitePlantCatalogRepository(database);
  if (demoMode) {
    const csvPath = join(
      app.getAppPath(),
      'apps',
      'desktop',
      'resources',
      'demo-catalog.csv',
    );
    seedDemoCatalog(database, readFileSync(csvPath, 'utf8'));
  }

  protocol.handle('garden-photo', (request) => {
    const filename = decodeURIComponent(new URL(request.url).pathname.slice(1));
    if (!filename || basename(filename) !== filename) {
      return new Response('Invalid image path', { status: 400 });
    }
    return net.fetch(pathToFileURL(join(photoDirectory, filename)).toString());
  });

  ipcMain.handle('catalog:list', (_event, page: number) =>
    listCatalogPage(page),
  );
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => database?.close());
