import type { IpcRenderer } from 'electron';
import {
  CATALOG_MANAGEMENT_CHANNELS,
  type CatalogManagementService,
} from '../../shared/catalog-management-service.js';

export function createCatalogManagementService(
  ipcRenderer: Pick<IpcRenderer, 'invoke'>,
): CatalogManagementService {
  return {
    replaceCatalog: (filename, csv) =>
      ipcRenderer.invoke(CATALOG_MANAGEMENT_CHANNELS.replace, filename, csv),
    getTemplate: () => ipcRenderer.invoke(CATALOG_MANAGEMENT_CHANNELS.template),
  };
}
