import type { PhotoImportFile } from '@my-little-garden/core';
import type { IpcMain } from 'electron';
import type { DatabaseSync } from 'node:sqlite';
import { PHOTO_CHANNELS } from '../../shared/photo-service.js';
import { deletePlantPhoto, importPlantPhotos } from '../photo-import.js';

export function registerPhotoHandlers(
  ipcMain: IpcMain,
  database: DatabaseSync,
  photoDirectory: string,
): void {
  ipcMain.handle(
    PHOTO_CHANNELS.import,
    (_event, files: readonly PhotoImportFile[]) =>
      importPlantPhotos(database, photoDirectory, files),
  );
  ipcMain.handle(PHOTO_CHANNELS.delete, (_event, plantId: string) =>
    deletePlantPhoto(database, photoDirectory, plantId),
  );
}
