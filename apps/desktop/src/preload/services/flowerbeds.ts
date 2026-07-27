import type { IpcRenderer } from 'electron';
import {
  FLOWERBED_CHANNELS,
  type FlowerbedService,
} from '../../shared/flowerbed-service.js';

export function createFlowerbedService(
  ipcRenderer: Pick<IpcRenderer, 'invoke'>,
): FlowerbedService {
  return {
    listFlowerbeds: () => ipcRenderer.invoke(FLOWERBED_CHANNELS.list),
    getFlowerbed: (flowerbedId) =>
      ipcRenderer.invoke(FLOWERBED_CHANNELS.get, flowerbedId),
    saveFlowerbed: (input) =>
      ipcRenderer.invoke(FLOWERBED_CHANNELS.save, input),
    deleteFlowerbed: (flowerbedId) =>
      ipcRenderer.invoke(FLOWERBED_CHANNELS.delete, flowerbedId),
  };
}
