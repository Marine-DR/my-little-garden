import type { IpcRenderer } from 'electron';
import {
  APPLICATION_CHANNELS,
  type ApplicationService,
} from '../../shared/application-service.js';

type IpcInvoker = Pick<IpcRenderer, 'invoke'>;

export function createApplicationService(
  ipcRenderer: IpcInvoker,
): ApplicationService {
  return {
    getVersion: () => ipcRenderer.invoke(APPLICATION_CHANNELS.version),
  };
}
