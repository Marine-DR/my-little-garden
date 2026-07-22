import type {
  FlowerbedRepository,
  FlowerbedSaveInput,
} from '@my-little-garden/core';
import type { IpcMain } from 'electron';
import { FLOWERBED_CHANNELS } from '../../shared/flowerbed-service.js';

export function registerFlowerbedHandlers(
  ipcMain: IpcMain,
  flowerbedRepository: FlowerbedRepository,
): void {
  ipcMain.handle(FLOWERBED_CHANNELS.list, () => flowerbedRepository.list());
  ipcMain.handle(FLOWERBED_CHANNELS.get, (_event, flowerbedId: string) =>
    flowerbedRepository.get(flowerbedId),
  );
  ipcMain.handle(FLOWERBED_CHANNELS.save, (_event, input: FlowerbedSaveInput) =>
    flowerbedRepository.save(input),
  );
  ipcMain.handle(FLOWERBED_CHANNELS.delete, (_event, flowerbedId: string) =>
    flowerbedRepository.delete(flowerbedId),
  );
}
