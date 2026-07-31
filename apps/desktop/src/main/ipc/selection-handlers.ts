import type {
  SelectionCreationInput,
  SelectionPlantAdditionInput,
  SelectionRepository,
} from '@my-little-garden/core';
import type { IpcMain } from 'electron';
import { SELECTION_CHANNELS } from '../../shared/selection-service.js';
import {
  acknowledgeModifiedSelectionPlants,
  acknowledgeDeletedSelectionPlants,
  getSelectionDetails,
  listSelectionSummaries,
  removePlantsFromSelection,
} from '../catalog-view.js';

export function registerSelectionHandlers(
  ipcMain: IpcMain,
  selectionRepository: SelectionRepository,
  photoDirectory: string,
): void {
  ipcMain.handle(SELECTION_CHANNELS.list, () =>
    listSelectionSummaries(selectionRepository),
  );
  ipcMain.handle(
    SELECTION_CHANNELS.create,
    (_event, input: SelectionCreationInput) =>
      selectionRepository.create(input),
  );
  ipcMain.handle(
    SELECTION_CHANNELS.acknowledgeDeleted,
    (_event, selectionId: string) =>
      acknowledgeDeletedSelectionPlants(
        selectionRepository,
        selectionId,
        photoDirectory,
      ),
  );
  ipcMain.handle(
    SELECTION_CHANNELS.addPlants,
    (_event, input: SelectionPlantAdditionInput) =>
      selectionRepository.addPlants(input),
  );
  ipcMain.handle(SELECTION_CHANNELS.get, (_event, selectionId: string) =>
    getSelectionDetails(selectionRepository, selectionId),
  );
  ipcMain.handle(
    SELECTION_CHANNELS.acknowledgeModified,
    (_event, selectionId: string) =>
      acknowledgeModifiedSelectionPlants(selectionRepository, selectionId),
  );
  ipcMain.handle(
    SELECTION_CHANNELS.removePlants,
    (_event, selectionId: string, plantIds: readonly string[]) =>
      removePlantsFromSelection(selectionRepository, selectionId, plantIds),
  );
}
