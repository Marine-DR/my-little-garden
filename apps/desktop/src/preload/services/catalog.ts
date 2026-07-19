import type { IpcRenderer } from 'electron';
import {
  CATALOG_CHANNELS,
  type CatalogService,
} from '../../shared/catalog-service.js';

export function createCatalogService(
  ipcRenderer: Pick<IpcRenderer, 'invoke'>,
): CatalogService {
  return {
    listPlants: (page, filters) =>
      ipcRenderer.invoke(CATALOG_CHANNELS.list, page, filters),
    listPlantIds: (filters) =>
      ipcRenderer.invoke(CATALOG_CHANNELS.listIds, filters),
    listFilterOptions: () => ipcRenderer.invoke(CATALOG_CHANNELS.filterOptions),
  };
}
