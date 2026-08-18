import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  runInTransaction,
  SqlitePlantPhotoRepository,
} from '@my-little-garden/database';
import type {
  PhotoDeleteResult,
  PhotoImportFile,
  PhotoImportResult,
} from '@my-little-garden/core';
import {
  deletePlantPhoto as deletePhoto,
  importPlantPhotos as importPhotos,
  validatePhotoFiles,
  type ManagedPhotoStorage,
} from '@my-little-garden/photo-handling';
import type { DatabaseSync } from 'node:sqlite';

class FileSystemPhotoStorage implements ManagedPhotoStorage {
  constructor(private readonly directory: string) {}

  stage(managedFilename: string, bytes: Uint8Array): void {
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(this.temporaryPath(managedFilename), bytes, { flag: 'wx' });
  }

  commit(managedFilename: string): void {
    renameSync(
      this.temporaryPath(managedFilename),
      this.managedPath(managedFilename),
    );
  }

  discard(managedFilename: string): void {
    rmSync(this.temporaryPath(managedFilename), { force: true });
    rmSync(this.managedPath(managedFilename), { force: true });
  }

  remove(managedFilename: string): void {
    rmSync(this.managedPath(managedFilename), { force: true });
  }

  private temporaryPath(managedFilename: string): string {
    return join(this.directory, `.${managedFilename}.tmp`);
  }

  private managedPath(managedFilename: string): string {
    return join(this.directory, managedFilename);
  }
}

function dependencies(database: DatabaseSync, photoDirectory: string) {
  return {
    repository: new SqlitePlantPhotoRepository(database),
    storage: new FileSystemPhotoStorage(photoDirectory),
    runInTransaction: <T>(operation: () => T) =>
      runInTransaction(database, operation),
    validatePhotoFiles,
  };
}

export function importPlantPhotos(
  database: DatabaseSync,
  photoDirectory: string,
  files: readonly PhotoImportFile[],
): PhotoImportResult {
  return importPhotos(dependencies(database, photoDirectory), files);
}

export function deletePlantPhoto(
  database: DatabaseSync,
  photoDirectory: string,
  plantId: string,
): PhotoDeleteResult {
  return deletePhoto(dependencies(database, photoDirectory), plantId);
}
