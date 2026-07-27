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
    previewCatalogAddition: (filename, csv) =>
      ipcRenderer.invoke(CATALOG_MANAGEMENT_CHANNELS.addPreview, filename, csv),
    commitCatalogAddition: (token, policy) =>
      ipcRenderer.invoke(CATALOG_MANAGEMENT_CHANNELS.addCommit, token, policy),
    previewCatalogModification: (filename, csv) =>
      ipcRenderer.invoke(
        CATALOG_MANAGEMENT_CHANNELS.modifyPreview,
        filename,
        csv,
      ),
    commitCatalogModification: (token, policy) =>
      ipcRenderer.invoke(
        CATALOG_MANAGEMENT_CHANNELS.modifyCommit,
        token,
        policy,
      ),
    getTemplate: () => ipcRenderer.invoke(CATALOG_MANAGEMENT_CHANNELS.template),
  };
}
