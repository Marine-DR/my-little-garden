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
  const migrationFilenames = [
    '001_initial_schema.sql',
    '002_remove_selection_normalized_name.sql',
    '003_flowerbed_designs.sql',
    '004_flowerbed_placement_color.sql',
    '005_flowerbed_boundary_points.sql',
    '006_planting_zone_boundary_points.sql',
  ];
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
  const storedVersion = database.prepare('PRAGMA user_version').get() as {
    user_version: number;
  };
  let version = hasPlants ? storedVersion.user_version : 0;
  if (hasPlants && version === 0) {
    const selectionColumns = database
      .prepare('PRAGMA table_info(selections)')
      .all()
      .map(({ name }) => String(name));
    version = selectionColumns.includes('normalized_name') ? 1 : 2;
  }

  for (let index = version; index < migrationFilenames.length; index += 1) {
    const filename = migrationFilenames[index];
    if (!filename) {
      throw new Error(`Missing database migration at index ${index}.`);
    }
    try {
      database.exec(readFileSync(join(migrationDirectory, filename), 'utf8'));
      database.exec(`PRAGMA user_version = ${index + 1}`);
    } finally {
      database.exec('PRAGMA foreign_keys = ON');
    }
  }
}
