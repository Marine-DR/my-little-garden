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
    deleteSelections: (selectionIds) =>
      ipcRenderer.invoke(SELECTION_CHANNELS.delete, selectionIds),
    getSelection: (selectionId) =>
      ipcRenderer.invoke(SELECTION_CHANNELS.get, selectionId),
    removePlantsFromSelection: (selectionId, plantIds) =>
      ipcRenderer.invoke(
        SELECTION_CHANNELS.removePlants,
        selectionId,
        plantIds,
      ),
    acknowledgeModifiedPlants: (selectionId) =>
      ipcRenderer.invoke(SELECTION_CHANNELS.acknowledgeModified, selectionId),
    acknowledgeDeletedPlants: (selectionId) =>
      ipcRenderer.invoke(SELECTION_CHANNELS.acknowledgeDeleted, selectionId),
    createSelection: (input) =>
      ipcRenderer.invoke(SELECTION_CHANNELS.create, input),
    addPlantsToSelection: (input) =>
      ipcRenderer.invoke(SELECTION_CHANNELS.addPlants, input),
  };
}
