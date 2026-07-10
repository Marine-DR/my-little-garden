import { randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { zipSync } from 'fflate';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deletePlantPhoto, importPlantPhotos } from '../src/main/photo-import';

const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);

describe('plant photo import', () => {
  let database: DatabaseSync;
  let directory: string;

  beforeEach(() => {
    database = new DatabaseSync(':memory:');
    database.exec(
      readFileSync(
        join(
          process.cwd(),
          'packages/database/migrations/001_initial_schema.sql',
        ),
        'utf8',
      ),
    );
    database
      .prepare(
        `INSERT INTO plants (id, name, normalized_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        'acorus',
        'Acorus',
        'acorus',
        new Date().toISOString(),
        new Date().toISOString(),
      );
    directory = join(process.cwd(), '.test-photos', randomUUID());
  });

  afterEach(() => {
    database.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it('matches names without case and replaces the single managed photo', () => {
    const first = importPlantPhotos(database, directory, [
      { name: 'ACORUS.png', bytes: png },
    ]);
    expect(first).toMatchObject({ ok: true, imported: 1 });
    const original = String(
      database.prepare('SELECT managed_filename FROM plant_photos').get()!
        .managed_filename,
    );

    const second = importPlantPhotos(database, directory, [
      { name: 'acorus.png', bytes: png },
    ]);
    expect(second).toMatchObject({ ok: true, imported: 1 });
    const replacement = String(
      database.prepare('SELECT managed_filename FROM plant_photos').get()!
        .managed_filename,
    );
    expect(replacement).not.toBe(original);
    expect(() => readFileSync(join(directory, original))).toThrow();
  });

  it('reports unmatched names and can delete a photo', () => {
    expect(
      importPlantPhotos(database, directory, [
        { name: 'Inconnue.png', bytes: png },
      ]),
    ).toEqual({ ok: true, imported: 0, unmatched: ['Inconnue.png'] });
    importPlantPhotos(database, directory, [
      { name: 'Acorus.png', bytes: png },
    ]);
    expect(deletePlantPhoto(database, directory, 'acorus')).toEqual({
      ok: true,
    });
    expect(
      database.prepare('SELECT count(*) AS total FROM plant_photos').get()!
        .total,
    ).toBe(0);
  });

  it('imports images from zip files', () => {
    const archive = zipSync({ 'nested/Acorus.png': png });

    expect(
      importPlantPhotos(database, directory, [
        { name: 'photos.zip', bytes: archive },
      ]),
    ).toMatchObject({ ok: true, imported: 1, unmatched: [] });
    expect(
      database.prepare('SELECT count(*) AS total FROM plant_photos').get()!
        .total,
    ).toBe(1);
  });

  it('ignores folder and system metadata entries in zip files', () => {
    const archive = zipSync({
      'nested/': new Uint8Array(),
      'nested/Acorus.png': png,
      '__MACOSX/nested/._Acorus.png': new Uint8Array([0]),
      'nested/.DS_Store': new Uint8Array([0]),
    });

    expect(
      importPlantPhotos(database, directory, [
        { name: 'photos.zip', bytes: archive },
      ]),
    ).toMatchObject({ ok: true, imported: 1, unmatched: [] });
  });

  it('does not ignore differences other than letter case', () => {
    expect(
      importPlantPhotos(database, directory, [
        { name: 'Àcorus.png', bytes: png },
      ]),
    ).toEqual({ ok: true, imported: 0, unmatched: ['Àcorus.png'] });
  });

  it('returns structured validation errors for invalid images', () => {
    expect(
      importPlantPhotos(database, directory, [
        { name: 'Acorus.txt', bytes: new Uint8Array([1, 2, 3]) },
      ]),
    ).toEqual({
      ok: false,
      errors: [
        {
          code: 'invalid_image',
          field: 'Acorus.txt',
          message: 'Acorus.txt n’est pas une image PNG, JPEG ou WebP valide.',
        },
      ],
    });
  });
});
