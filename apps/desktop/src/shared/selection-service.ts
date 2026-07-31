import type {
  SelectionCreationInput,
  SelectionCreationResult,
  SelectionDetails,
  SelectionPlantAdditionInput,
  SelectionPlantAdditionResult,
  SelectionSummary,
} from '@my-little-garden/core';

export const SELECTION_CHANNELS = {
  list: 'selections:list',
  create: 'selections:create',
  addPlants: 'selections:add-plants',
  get: 'selections:get',
  removePlants: 'selections:remove-plants',
  acknowledgeModified: 'selections:acknowledge-modified',
  acknowledgeDeleted: 'selections:acknowledge-deleted',
} as const;

export interface SelectionService {
  listSelections(): Promise<readonly SelectionSummary[]>;
  getSelection(selectionId: string): Promise<SelectionDetails | null>;
  removePlantsFromSelection(
    selectionId: string,
    plantIds: readonly string[],
  ): Promise<SelectionDetails | null>;
  acknowledgeModifiedPlants(
    selectionId: string,
  ): Promise<SelectionDetails | null>;
  acknowledgeDeletedPlants(
    selectionId: string,
  ): Promise<SelectionDetails | null>;
  createSelection(
    input: SelectionCreationInput,
  ): Promise<SelectionCreationResult>;
  addPlantsToSelection(
    input: SelectionPlantAdditionInput,
  ): Promise<SelectionPlantAdditionResult>;
}
