import type { CatalogApi } from '@my-little-garden/core';
import type { IpcMain } from 'electron';

export interface IpcHandlerDependencies {
  readonly ipcMain: IpcMain;
  readonly desktopApi: CatalogApi;
}

export function registerIpcHandlers({
  ipcMain,
  desktopApi,
}: IpcHandlerDependencies): void {
  ipcMain.handle('catalog:list', (_event, page: number, filters) =>
    desktopApi.listPlants(page, filters),
  );
  ipcMain.handle('catalog:list-ids', (_event, filters) =>
    desktopApi.listPlantIds(filters),
  );
  ipcMain.handle('catalog:filter-options', () =>
    desktopApi.listFilterOptions(),
  );
  ipcMain.handle('selections:list', () => desktopApi.listSelections());
  ipcMain.handle('selections:create', (_event, input) =>
    desktopApi.createSelection(input),
  );
  ipcMain.handle('selections:add-plants', (_event, input) =>
    desktopApi.addPlantsToSelection(input),
  );
  ipcMain.handle('selections:get', (_event, selectionId: string) =>
    desktopApi.getSelection(selectionId),
  );
  ipcMain.handle(
    'selections:remove-plants',
    (_event, selectionId: string, plantIds: readonly string[]) =>
      desktopApi.removePlantsFromSelection(selectionId, plantIds),
  );
  ipcMain.handle('catalog:replace', (_event, filename: string, csv: string) =>
    desktopApi.replaceCatalog(filename, csv),
  );
  ipcMain.handle('photos:import', (_event, files) =>
    desktopApi.importPhotos(files),
  );
  ipcMain.handle('photos:delete', (_event, plantId: string) =>
    desktopApi.deletePhoto(plantId),
  );
}
