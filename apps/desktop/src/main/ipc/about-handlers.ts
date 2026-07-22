import type { IpcMain } from 'electron';
import { ABOUT_CHANNELS, type About } from '../../shared/about-service.js';

export function registerAboutHandlers(ipcMain: IpcMain, about: About): void {
  ipcMain.handle(ABOUT_CHANNELS.get, () => about);
}
