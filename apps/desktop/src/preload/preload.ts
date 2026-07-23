import { contextBridge, ipcRenderer } from 'electron';
import { createAboutService } from './services/about.js';
import { createCatalogManagementService } from './services/catalog-management.js';
import { createCatalogService } from './services/catalog.js';
import { createPhotoService } from './services/photos.js';
import { createSelectionService } from './services/selections.js';

contextBridge.exposeInMainWorld(
  'aboutService',
  createAboutService(ipcRenderer),
);

contextBridge.exposeInMainWorld(
  'catalogService',
  createCatalogService(ipcRenderer),
);
contextBridge.exposeInMainWorld(
  'selectionService',
  createSelectionService(ipcRenderer),
);
contextBridge.exposeInMainWorld(
  'catalogManagementService',
  createCatalogManagementService(ipcRenderer),
);
contextBridge.exposeInMainWorld(
  'photoService',
  createPhotoService(ipcRenderer),
);
