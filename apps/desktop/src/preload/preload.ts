import { contextBridge, ipcRenderer } from 'electron';
import type { CatalogApi } from '../shared/catalog.js';

const catalogApi: CatalogApi = {
  listPlants: (page) => ipcRenderer.invoke('catalog:list', page),
  replaceCatalog: (filename, csv) =>
    ipcRenderer.invoke('catalog:replace', filename, csv),
};

contextBridge.exposeInMainWorld('catalogApi', catalogApi);
