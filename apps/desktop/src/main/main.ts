import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import {
  EXPOSURE_CODES,
  type ExposureCode,
  type Plant,
  type PlantCatalogRepository,
} from '@my-little-garden/core';
import { SqlitePlantCatalogRepository } from '@my-little-garden/database';
import { createPhotoUrl } from '@my-little-garden/photo-handling';
import { DatabaseSync } from 'node:sqlite';
import { app, BrowserWindow, ipcMain } from 'electron';
import type {
  CatalogImportError,
  CatalogFilterOptions,
  CatalogFilters,
  CatalogImportResult,
  CatalogPage,
  CatalogPlant,
} from '../shared/catalog.js';
import {
  replaceCatalogFromCsv,
  seedDemoCatalog,
  validateCatalogCsvStructure,
} from './catalog-import.js';
import { deletePlantPhoto, importPlantPhotos } from './photo-import.js';
import { handlePhotoRequests, registerPhotoScheme } from './photo-protocol.js';

registerPhotoScheme();

let database: DatabaseSync;
let catalogRepository: PlantCatalogRepository;
const CATALOG_PAGE_SIZE = 25;
const MONTHS = Array.from({ length: 12 }, (_value, index) => index + 1);

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

function toCatalogPlant(plant: Plant): CatalogPlant {
  return {
    id: plant.id,
    name: plant.name,
    photoUrl: createPhotoUrl(plant.photo?.managedFilename ?? null),
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

function activeBloomMonths(start: number, end: number): number[] {
  if (start <= end) {
    return MONTHS.filter((month) => month >= start && month <= end);
  }
  return MONTHS.filter((month) => month >= start || month <= end);
}

function sanitizeCatalogFilters(
  filters: CatalogFilters | undefined,
): CatalogFilters {
  return {
    soils: [...new Set(filters?.soils.filter((value) => value.trim()) ?? [])],
    exposures: [
      ...new Set(
        filters?.exposures.filter((value): value is ExposureCode =>
          EXPOSURE_CODES.includes(value),
        ) ?? [],
      ),
    ],
    bloomMonths: [
      ...new Set(
        filters?.bloomMonths
          .map((value) => Math.trunc(value))
          .filter((value) => value >= 1 && value <= 12) ?? [],
      ),
    ],
  };
}

function listCatalogFilterOptions(): CatalogFilterOptions {
  const soils = database
    .prepare(
      `SELECT DISTINCT st.label, st.normalized_label FROM soil_types st
       JOIN plant_soils ps ON ps.soil_type_id = st.id
       ORDER BY st.normalized_label`,
    )
    .all()
    .map((row) => String(row.label));
  const exposures = database
    .prepare(
      `SELECT DISTINCT exposure_code FROM plant_exposures
       ORDER BY CASE exposure_code
         WHEN 'sun' THEN 1 WHEN 'partial_shade' THEN 2 ELSE 3 END`,
    )
    .all()
    .map((row) => String(row.exposure_code))
    .filter((value): value is ExposureCode =>
      EXPOSURE_CODES.includes(value as ExposureCode),
    );
  const bloomMonths = [
    ...new Set(
      database
        .prepare(
          `SELECT bloom_start_month, bloom_end_month FROM plants
           WHERE bloom_start_month IS NOT NULL
             AND bloom_end_month IS NOT NULL`,
        )
        .all()
        .flatMap((row) =>
          activeBloomMonths(
            Number(row.bloom_start_month),
            Number(row.bloom_end_month),
          ),
        ),
    ),
  ].sort((left, right) => left - right);
  return { soils, exposures, bloomMonths };
}

async function listCatalogPage(
  requestedPage: number,
  filters?: CatalogFilters,
): Promise<CatalogPage> {
  const normalizedPage = Math.max(1, Math.trunc(requestedPage) || 1);
  const activeFilters = sanitizeCatalogFilters(filters);
  let result = await catalogRepository.list({
    offset: (normalizedPage - 1) * CATALOG_PAGE_SIZE,
    limit: CATALOG_PAGE_SIZE,
    filters: activeFilters,
  });
  const pageCount = Math.max(1, Math.ceil(result.total / CATALOG_PAGE_SIZE));
  const page = Math.min(normalizedPage, pageCount);
  if (page !== normalizedPage) {
    result = await catalogRepository.list({
      offset: (page - 1) * CATALOG_PAGE_SIZE,
      limit: CATALOG_PAGE_SIZE,
      filters: activeFilters,
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
    icon: join(
      app.getAppPath(),
      'apps',
      'desktop',
      'src',
      'renderer',
      'assets',
      'app-icon.png',
    ),
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

  handlePhotoRequests(photoDirectory);

  ipcMain.handle('catalog:list', (_event, page: number, filters) =>
    listCatalogPage(page, filters),
  );
  ipcMain.handle('catalog:filter-options', () => listCatalogFilterOptions());
  ipcMain.handle(
    'catalog:replace',
    (_event, filename: string, csv: string): CatalogImportResult => {
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
        return {
          ok: false,
          errors: [
            {
              code: 'invalid_csv',
              message: 'Le contenu du fichier CSV est invalide.',
            },
          ],
        };
      }
      errors.push(...validateCatalogCsvStructure(csv));
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
    },
  );
  ipcMain.handle('photos:import', (_event, files) =>
    importPlantPhotos(database, photoDirectory, files),
  );
  ipcMain.handle('photos:delete', (_event, plantId: string) =>
    deletePlantPhoto(database, photoDirectory, plantId),
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
