// @vitest-environment node

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { App } from 'electron';
import { afterEach, describe, expect, it } from 'vitest';
import { openApplicationDatabase } from '../src/main/database';

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('openApplicationDatabase', () => {
  it('upgrades and preserves a catalog created before v0.3', () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), 'my-little-garden-db-'));
    temporaryDirectories.push(dataDirectory);
    const databasePath = join(dataDirectory, 'catalog.sqlite');
    const legacyDatabase = new DatabaseSync(databasePath);
    legacyDatabase.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE plant_types (
        id INTEGER PRIMARY KEY,
        label TEXT NOT NULL,
        normalized_label TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE soil_types (
        id INTEGER PRIMARY KEY,
        label TEXT NOT NULL,
        normalized_label TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE colors (
        id INTEGER PRIMARY KEY,
        label TEXT NOT NULL,
        normalized_label TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE plants (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL UNIQUE,
        type_id INTEGER REFERENCES plant_types(id),
        plant_kind TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      INSERT INTO plant_types VALUES (1, 'Vivace', 'vivace', '2026-08-01');
      INSERT INTO plants VALUES (
        'plant-1', 'Achillée', 'achillee', 1, 'flower',
        '2026-08-01', '2026-08-01'
      );
      PRAGMA user_version = 5;
    `);
    legacyDatabase.close();

    const app = {
      getPath: () => dataDirectory,
      getAppPath: () => resolve('.'),
    } as unknown as App;
    const database = openApplicationDatabase(app);

    expect(
      database
        .prepare(
          "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'referential_plant_types'",
        )
        .get(),
    ).toBeDefined();
    expect(
      database
        .prepare(
          `SELECT p.name, pt.label AS type_label, pk.label AS kind_label
           FROM plants p
           JOIN referential_plant_types pt ON pt.id = p.type_id
           JOIN plant_kind_assignments pka ON pka.plant_id = p.id
           JOIN referential_plant_kinds pk ON pk.id = pka.plant_kind_id`,
        )
        .get(),
    ).toEqual({
      name: 'Achillée',
      type_label: 'Vivace',
      kind_label: 'Fleur',
    });
    expect(database.prepare('PRAGMA user_version').get()).toEqual({
      user_version: 5,
    });
    database.close();
  });
});
