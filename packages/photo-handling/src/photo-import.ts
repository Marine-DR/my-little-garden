import { createHash, randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import type {
  PlantPhotoRepository,
  PlantPhotoTarget,
  PhotoImportError,
  PhotoDeleteResult,
  PhotoImportFile,
  PhotoImportResult,
} from '@my-little-garden/core';
import type { ValidImage } from './index';

export interface ManagedPhotoStorage {
  stage(managedFilename: string, bytes: Uint8Array): void;
  commit(managedFilename: string): void;
  discard(managedFilename: string): void;
  remove(managedFilename: string): void;
}

export interface PhotoImportDependencies {
  readonly repository: PlantPhotoRepository;
  readonly storage: ManagedPhotoStorage;
  readonly runInTransaction: <T>(operation: () => T) => T;
  readonly validatePhotoFiles: (files: readonly PhotoImportFile[]) => {
    images: ValidImage[];
    errors: PhotoImportError[];
  };
  readonly now?: () => string;
  readonly createManagedFilename?: (extension: string) => string;
}

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
  storage: ManagedPhotoStorage,
  staged: readonly StagedPhoto[],
): void {
  for (const item of staged) {
    storage.discard(item.managed);
  }
}

function removePreviousFiles(
  storage: ManagedPhotoStorage,
  staged: readonly StagedPhoto[],
): void {
  for (const item of staged) {
    if (item.previous) {
      storage.remove(item.previous);
    }
  }
}

type StagedPhoto = {
  plantId: string;
  managed: string;
  previous: string | null;
  image: ValidImage;
};

function stagePhotos(
  storage: ManagedPhotoStorage,
  matched: ReadonlyMap<string, ValidImage>,
  previousByPlant: ReadonlyMap<string, string | null>,
  createManagedFilename: (extension: string) => string,
): StagedPhoto[] {
  const staged: StagedPhoto[] = [];
  try {
    for (const [plantId, image] of matched) {
      const managed = createManagedFilename(image.extension);
      storage.stage(managed, image.bytes);
      staged.push({
        plantId,
        managed,
        previous: previousByPlant.get(plantId) ?? null,
        image,
      });
    }
  } catch (error) {
    removeStagedFiles(storage, staged);
    throw error;
  }
  return staged;
}

function persistPhotos(
  dependencies: PhotoImportDependencies,
  staged: readonly StagedPhoto[],
): void {
  dependencies.runInTransaction(() => {
    const createdAt = dependencies.now?.() ?? new Date().toISOString();
    for (const item of staged) {
      dependencies.storage.commit(item.managed);
      dependencies.repository.upsert({
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
  dependencies: PhotoImportDependencies,
  files: readonly PhotoImportFile[],
): PhotoImportResult {
  try {
    const validation = dependencies.validatePhotoFiles(files);
    if (validation.errors.length > 0) {
      return { ok: false, errors: validation.errors };
    }
    const plants = dependencies.repository.listTargets();
    const matching = matchImagesToPlants(validation.images, plants);
    if (!matching.ok) {
      return matching.result;
    }
    const staged = stagePhotos(
      dependencies.storage,
      matching.matched,
      currentPhotoByPlant(plants),
      dependencies.createManagedFilename ??
        ((extension) => `${randomUUID()}${extension}`),
    );

    try {
      persistPhotos(dependencies, staged);
    } catch (error) {
      removeStagedFiles(dependencies.storage, staged);
      throw error;
    }
    removePreviousFiles(dependencies.storage, staged);
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
  dependencies: Pick<PhotoImportDependencies, 'repository' | 'storage'>,
  plantId: string,
): PhotoDeleteResult {
  try {
    const filename = dependencies.repository.deleteByPlantId(plantId);
    if (filename) {
      dependencies.storage.remove(filename);
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'La photo n’a pas pu être supprimée.' };
  }
}
