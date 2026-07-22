import type { IpcRenderer } from 'electron';
import {
  ABOUT_CHANNELS,
  type AboutService,
} from '../../shared/about-service.js';

type IpcInvoker = Pick<IpcRenderer, 'invoke'>;

export function createAboutService(ipcRenderer: IpcInvoker): AboutService {
  return {
    getAbout: () => ipcRenderer.invoke(ABOUT_CHANNELS.get),
  };
}
