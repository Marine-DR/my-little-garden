import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';
import {
  runInTransaction,
  SqlitePlantPhotoRepository,
} from '@my-little-garden/database';
import type {
  PlantPhotoRepository,
  PlantPhotoTarget,
  PhotoDeleteResult,
  PhotoImportFile,
  PhotoImportResult,
} from '@my-little-garden/core';
import {
  validatePhotoFiles,
  type ValidImage,
} from '@my-little-garden/photo-handling';
import type { DatabaseSync } from 'node:sqlite';

function caseInsensitiveName(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase('fr');
}

function matchImagesToPlants(
  images: readonly ValidImage[],
  plants: readonly PlantPhotoTarget[],
):
  | { ok: true; matched: Map<string, ValidImage>; unmatched: string[] }
  | { ok: false; result: PhotoImportResult } {
  const byName = new Map(
    plants.map((plant) => [
      caseInsensitiveName(plant.plantName),
      plant.plantId,
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
        result: {
          ok: false,
          errors: [
            {
              code: 'duplicate_plant_photo',
              field: image.name,
              message:
                'Plusieurs images correspondent à la même plante dans l’import.',
            },
          ],
        },
      };
    } else {
      matched.set(plantId, image);
    }
  }
  return { ok: true, matched, unmatched };
}

function currentPhotoByPlant(
  plants: readonly PlantPhotoTarget[],
): Map<string, string | null> {
  return new Map(plants.map((plant) => [plant.plantId, plant.managedFilename]));
}

function checksum(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function removeStagedFiles(
  photoDirectory: string,
  staged: readonly StagedPhoto[],
): void {
  for (const item of staged) {
    rmSync(item.temporary, { force: true });
    rmSync(join(photoDirectory, item.managed), { force: true });
  }
}

function removePreviousFiles(
  photoDirectory: string,
  staged: readonly StagedPhoto[],
): void {
  for (const item of staged) {
    if (item.previous) {
      rmSync(join(photoDirectory, item.previous), { force: true });
    }
  }
}

type StagedPhoto = {
  plantId: string;
  temporary: string;
  managed: string;
  previous: string | null;
  image: ValidImage;
};

function stagePhotos(
  photoDirectory: string,
  matched: ReadonlyMap<string, ValidImage>,
  previousByPlant: ReadonlyMap<string, string | null>,
): StagedPhoto[] {
  mkdirSync(photoDirectory, { recursive: true });
  const staged: StagedPhoto[] = [];
  for (const [plantId, image] of matched) {
    const managed = `${randomUUID()}${image.extension}`;
    const temporary = join(photoDirectory, `.${managed}.tmp`);
    writeFileSync(temporary, image.bytes, { flag: 'wx' });
    staged.push({
      plantId,
      temporary,
      managed,
      previous: previousByPlant.get(plantId) ?? null,
      image,
    });
  }
  return staged;
}

function persistPhotos(
  database: DatabaseSync,
  repository: PlantPhotoRepository,
  photoDirectory: string,
  staged: readonly StagedPhoto[],
): void {
  runInTransaction(database, () => {
    const createdAt = new Date().toISOString();
    for (const item of staged) {
      renameSync(item.temporary, join(photoDirectory, item.managed));
      repository.upsert({
        plantId: item.plantId,
        managedFilename: item.managed,
        mediaType: item.image.mediaType,
        checksumSha256: checksum(item.image.bytes),
        createdAt,
      });
    }
  });
}

export function importPlantPhotos(
  database: DatabaseSync,
  photoDirectory: string,
  files: readonly PhotoImportFile[],
): PhotoImportResult {
  try {
    const repository = new SqlitePlantPhotoRepository(database);
    const validation = validatePhotoFiles(files);
    if (validation.errors.length > 0) {
      return { ok: false, errors: validation.errors };
    }
    const plants = repository.listTargets();
    const matching = matchImagesToPlants(validation.images, plants);
    if (!matching.ok) {
      return matching.result;
    }
    const staged = stagePhotos(
      photoDirectory,
      matching.matched,
      currentPhotoByPlant(plants),
    );

    try {
      persistPhotos(database, repository, photoDirectory, staged);
    } catch (error) {
      removeStagedFiles(photoDirectory, staged);
      throw error;
    }
    removePreviousFiles(photoDirectory, staged);
    return { ok: true, imported: staged.length, unmatched: matching.unmatched };
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
    const filename = new SqlitePlantPhotoRepository(database).deleteByPlantId(
      plantId,
    );
    if (filename) {
      rmSync(join(photoDirectory, filename), { force: true });
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'La photo n’a pas pu être supprimée.' };
  }
}
