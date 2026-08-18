import type {
  CatalogFilters,
  PlantCatalogRepository,
  SelectionRepository,
} from '@my-little-garden/core';
import {
  acknowledgeDeletedSelectionPlants as acknowledgeDeleted,
  acknowledgeModifiedSelectionPlants as acknowledgeModified,
  getSelectionDetails as getDetails,
  listCatalogPage as listPage,
  listSelectionSummaries as listSummaries,
  removePlantsFromSelection as removePlants,
} from '@my-little-garden/core';
import { createPhotoUrl } from '@my-little-garden/photo-handling';

export const listCatalogPage = (
  repository: PlantCatalogRepository,
  page: number,
  filters?: CatalogFilters,
) => listPage(repository, createPhotoUrl, page, filters);

export const listSelectionSummaries = (repository: SelectionRepository) =>
  listSummaries(repository, createPhotoUrl);

export const getSelectionDetails = (
  repository: SelectionRepository,
  selectionId: string,
) => getDetails(repository, createPhotoUrl, selectionId);

export const removePlantsFromSelection = (
  repository: SelectionRepository,
  selectionId: string,
  plantIds: readonly string[],
) => removePlants(repository, createPhotoUrl, selectionId, plantIds);

export const acknowledgeModifiedSelectionPlants = (
  repository: SelectionRepository,
  selectionId: string,
) => acknowledgeModified(repository, createPhotoUrl, selectionId);

export const acknowledgeDeletedSelectionPlants = (
  repository: SelectionRepository,
  selectionId: string,
) => acknowledgeDeleted(repository, createPhotoUrl, selectionId);
