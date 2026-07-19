import type { IpcRenderer } from 'electron';
import {
  SELECTION_CHANNELS,
  type SelectionService,
} from '../../shared/selection-service.js';

export function createSelectionService(
  ipcRenderer: Pick<IpcRenderer, 'invoke'>,
): SelectionService {
  return {
    listSelections: () => ipcRenderer.invoke(SELECTION_CHANNELS.list),
    getSelection: (selectionId) =>
      ipcRenderer.invoke(SELECTION_CHANNELS.get, selectionId),
    removePlantsFromSelection: (selectionId, plantIds) =>
      ipcRenderer.invoke(
        SELECTION_CHANNELS.removePlants,
        selectionId,
        plantIds,
      ),
    createSelection: (input) =>
      ipcRenderer.invoke(SELECTION_CHANNELS.create, input),
    addPlantsToSelection: (input) =>
      ipcRenderer.invoke(SELECTION_CHANNELS.addPlants, input),
  };
}
