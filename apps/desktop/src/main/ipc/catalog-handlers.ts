import type {
  CatalogFilters,
  PlantCatalogRepository,
} from '@my-little-garden/core';
import type { IpcMain } from 'electron';
import { CATALOG_CHANNELS } from '../../shared/catalog-service.js';
import { listCatalogPage } from '../catalog-view.js';

export function registerCatalogHandlers(
  ipcMain: IpcMain,
  catalogRepository: PlantCatalogRepository,
): void {
  ipcMain.handle(
    CATALOG_CHANNELS.list,
    (_event, page: number, filters?: CatalogFilters) =>
      listCatalogPage(catalogRepository, page, filters),
  );
  ipcMain.handle(CATALOG_CHANNELS.listIds, (_event, filters?: CatalogFilters) =>
    catalogRepository.listIds(filters),
  );
  ipcMain.handle(CATALOG_CHANNELS.filterOptions, () =>
    catalogRepository.listFilterOptions(),
  );
}
