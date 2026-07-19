import type { IpcRenderer } from 'electron';
import {
  PHOTO_CHANNELS,
  type PhotoService,
} from '../../shared/photo-service.js';

export function createPhotoService(
  ipcRenderer: Pick<IpcRenderer, 'invoke'>,
): PhotoService {
  return {
    importPhotos: (files) => ipcRenderer.invoke(PHOTO_CHANNELS.import, files),
    deletePhoto: (plantId) =>
      ipcRenderer.invoke(PHOTO_CHANNELS.delete, plantId),
  };
}
