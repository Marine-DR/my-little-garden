import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import { runInTransaction } from '@my-little-garden/database';
import type { DatabaseSync } from 'node:sqlite';
import type {
  PhotoDeleteResult,
  PhotoImportFile,
  PhotoImportResult,
} from '../shared/catalog.js';
import {
  validatePhotoFiles,
  type ValidImage,
} from './photo-file-validation.js';

function caseInsensitiveName(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('fr');
}

export function importPlantPhotos(
  database: DatabaseSync,
  photoDirectory: string,
  files: readonly PhotoImportFile[],
): PhotoImportResult {
  try {
    const validation = validatePhotoFiles(files);
    if (validation.errors.length > 0) {
      return { ok: false, errors: validation.errors };
    }
    const { images } = validation;

    const plants = database.prepare('SELECT id, name FROM plants').all();
    const byName = new Map(
      plants.map((row) => [
        caseInsensitiveName(String(row.name)),
        String(row.id),
      ]),
    );
    const matched = new Map<string, ValidImage>();
    const unmatched: string[] = [];
    for (const image of images) {
      const plantId = byName.get(
        caseInsensitiveName(basename(image.name, extname(image.name))),
      );
      if (!plantId) {
        unmatched.push(image.name);
      } else if (matched.has(plantId)) {
        return {
          ok: false,
          errors: [
            {
              code: 'duplicate_plant_photo',
              field: image.name,
              message:
                'Plusieurs images correspondent à la même plante dans l’import.',
            },
          ],
        };
      } else {
        matched.set(plantId, image);
      }
    }

    mkdirSync(photoDirectory, { recursive: true });
    const staged: {
      plantId: string;
      temporary: string;
      managed: string;
      previous: string | null;
      image: ValidImage;
    }[] = [];
    for (const [plantId, image] of matched) {
      const managed = `${randomUUID()}${image.extension}`;
      const temporary = join(photoDirectory, `.${managed}.tmp`);
      writeFileSync(temporary, image.bytes, { flag: 'wx' });
      const previousRow = database
        .prepare('SELECT managed_filename FROM plant_photos WHERE plant_id = ?')
        .get(plantId);
      staged.push({
        plantId,
        temporary,
        managed,
        previous: previousRow ? String(previousRow.managed_filename) : null,
        image,
      });
    }

    try {
      runInTransaction(database, () => {
        const upsert = database.prepare(`INSERT INTO plant_photos
          (plant_id, managed_filename, media_type, checksum_sha256, created_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(plant_id) DO UPDATE SET managed_filename=excluded.managed_filename,
            media_type=excluded.media_type, checksum_sha256=excluded.checksum_sha256,
            created_at=excluded.created_at`);
        for (const item of staged) {
          renameSync(item.temporary, join(photoDirectory, item.managed));
          upsert.run(
            item.plantId,
            item.managed,
            item.image.mediaType,
            createHash('sha256').update(item.image.bytes).digest('hex'),
            new Date().toISOString(),
          );
        }
      });
    } catch (error) {
      for (const item of staged) {
        rmSync(item.temporary, { force: true });
        rmSync(join(photoDirectory, item.managed), { force: true });
      }
      throw error;
    }
    for (const item of staged) {
      if (item.previous) {
        rmSync(join(photoDirectory, item.previous), { force: true });
      }
    }
    return { ok: true, imported: staged.length, unmatched };
  } catch (error) {
    return {
      ok: false,
      errors: [
        {
          code: 'photo_import_failed',
          message:
            error instanceof Error
              ? error.message
              : 'Les images n’ont pas pu être importées.',
        },
      ],
    };
  }
}

export function deletePlantPhoto(
  database: DatabaseSync,
  photoDirectory: string,
  plantId: string,
): PhotoDeleteResult {
  try {
    const row = database
      .prepare('SELECT managed_filename FROM plant_photos WHERE plant_id = ?')
      .get(plantId);
    if (!row) {
      return { ok: true };
    }
    database
      .prepare('DELETE FROM plant_photos WHERE plant_id = ?')
      .run(plantId);
    rmSync(join(photoDirectory, String(row.managed_filename)), { force: true });
    return { ok: true };
  } catch {
    return { ok: false, error: 'La photo n’a pas pu être supprimée.' };
  }
}
