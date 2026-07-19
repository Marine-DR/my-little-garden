import type {
  PhotoDeleteResult,
  PhotoImportFile,
  PhotoImportResult,
} from '@my-little-garden/core';

export const PHOTO_CHANNELS = {
  import: 'photos:import',
  delete: 'photos:delete',
} as const;

export interface PhotoService {
  importPhotos(files: readonly PhotoImportFile[]): Promise<PhotoImportResult>;
  deletePhoto(plantId: string): Promise<PhotoDeleteResult>;
}
