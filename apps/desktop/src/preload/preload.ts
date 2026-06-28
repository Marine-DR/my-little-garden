import { contextBridge, ipcRenderer } from 'electron';
import type { CatalogApi } from '../shared/catalog.js';

const catalogApi: CatalogApi = {
  listPlants: (page) => ipcRenderer.invoke('catalog:list', page),
};

contextBridge.exposeInMainWorld('catalogApi', catalogApi);

