import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { App } from 'electron';
import { DatabaseSync } from 'node:sqlite';

export function openApplicationDatabase(app: App): DatabaseSync {
  const demoMode = process.env.MY_LITTLE_GARDEN_DEMO === '1';
  const dataDirectory = app.getPath('userData');
  const database = new DatabaseSync(
    demoMode ? ':memory:' : join(dataDirectory, 'catalog.sqlite'),
  );
  database.exec('PRAGMA foreign_keys = ON');
  ensureSchema(app, database);
  return database;
}

export function applicationPhotoDirectory(app: App): string {
  return join(app.getPath('userData'), 'images');
}

export function seedDemoCatalogIfNeeded(
  app: App,
  seedCatalog: (csv: string) => void,
): void {
  if (process.env.MY_LITTLE_GARDEN_DEMO !== '1') {
    return;
  }

  const csvPath = join(
    app.getAppPath(),
    'apps',
    'desktop',
    'resources',
    'demo-catalog.csv',
  );
  seedCatalog(readFileSync(csvPath, 'utf8'));
}

function ensureSchema(app: App, database: DatabaseSync): void {
  const hasPlants = database
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
    database.exec(
      readFileSync(join(migrationDirectory, '001_initial_schema.sql'), 'utf8'),
    );
  }
}
