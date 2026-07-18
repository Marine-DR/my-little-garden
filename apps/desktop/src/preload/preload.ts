import { contextBridge, ipcRenderer } from 'electron';
import type { CatalogApi } from '@my-little-garden/core';

const catalogApi: CatalogApi = {
  listPlants: (page, filters) =>
    ipcRenderer.invoke('catalog:list', page, filters),
  listPlantIds: (filters) => ipcRenderer.invoke('catalog:list-ids', filters),
  listFilterOptions: () => ipcRenderer.invoke('catalog:filter-options'),
  listSelections: () => ipcRenderer.invoke('selections:list'),
  getSelection: (selectionId) =>
    ipcRenderer.invoke('selections:get', selectionId),
  removePlantsFromSelection: (selectionId, plantIds) =>
    ipcRenderer.invoke('selections:remove-plants', selectionId, plantIds),
  createSelection: (input) => ipcRenderer.invoke('selections:create', input),
  addPlantsToSelection: (input) =>
    ipcRenderer.invoke('selections:add-plants', input),
  replaceCatalog: (filename, csv) =>
    ipcRenderer.invoke('catalog:replace', filename, csv),
  importPhotos: (files) => ipcRenderer.invoke('photos:import', files),
  deletePhoto: (plantId) => ipcRenderer.invoke('photos:delete', plantId),
};

contextBridge.exposeInMainWorld('catalogApi', catalogApi);
