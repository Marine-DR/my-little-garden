import type { IpcMain } from 'electron';
import { APPLICATION_CHANNELS } from '../../shared/application-service.js';

export function registerApplicationHandlers(
  ipcMain: IpcMain,
  version: string,
): void {
  ipcMain.handle(APPLICATION_CHANNELS.version, () => version);
}
