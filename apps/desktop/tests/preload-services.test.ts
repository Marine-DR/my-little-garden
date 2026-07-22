// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import { createAboutService } from '../src/preload/services/about';
import { createCatalogManagementService } from '../src/preload/services/catalog-management';
import { createCatalogService } from '../src/preload/services/catalog';
import { createPhotoService } from '../src/preload/services/photos';
import { createSelectionService } from '../src/preload/services/selections';
import { ABOUT_CHANNELS } from '../src/shared/about-service';
import { CATALOG_MANAGEMENT_CHANNELS } from '../src/shared/catalog-management-service';
import { CATALOG_CHANNELS } from '../src/shared/catalog-service';
import { PHOTO_CHANNELS } from '../src/shared/photo-service';
import { SELECTION_CHANNELS } from '../src/shared/selection-service';

function createRenderer() {
  return { invoke: vi.fn(async () => undefined) };
}

describe('preload services', () => {
  it('reads the release about properties', async () => {
    const renderer = createRenderer();
    const service = createAboutService(renderer);

    await service.getAbout();

    expect(renderer.invoke).toHaveBeenCalledWith(ABOUT_CHANNELS.get);
  });

  it('declares catalog query actions on the catalog service', async () => {
    const renderer = createRenderer();
    const service = createCatalogService(renderer);

    await service.listPlants(2);
    await service.listPlantIds();
    await service.listFilterOptions();

    expect(renderer.invoke.mock.calls).toEqual([
      [CATALOG_CHANNELS.list, 2, undefined],
      [CATALOG_CHANNELS.listIds, undefined],
      [CATALOG_CHANNELS.filterOptions],
    ]);
  });

  it('declares selection actions on the selection service', async () => {
    const renderer = createRenderer();
    const service = createSelectionService(renderer);

    await service.listSelections();
    await service.getSelection('selection-1');
    await service.removePlantsFromSelection('selection-1', ['plant-1']);
    await service.createSelection({ name: 'Soleil', plantIds: ['plant-1'] });
    await service.addPlantsToSelection({
      selectionId: 'selection-1',
      plantIds: ['plant-2'],
    });

    expect(renderer.invoke.mock.calls).toEqual([
      [SELECTION_CHANNELS.list],
      [SELECTION_CHANNELS.get, 'selection-1'],
      [SELECTION_CHANNELS.removePlants, 'selection-1', ['plant-1']],
      [SELECTION_CHANNELS.create, { name: 'Soleil', plantIds: ['plant-1'] }],
      [
        SELECTION_CHANNELS.addPlants,
        { selectionId: 'selection-1', plantIds: ['plant-2'] },
      ],
    ]);
  });

  it('keeps catalog management and photo actions in dedicated services', async () => {
    const catalogRenderer = createRenderer();
    const photoRenderer = createRenderer();
    const catalogManagement = createCatalogManagementService(catalogRenderer);
    const photos = createPhotoService(photoRenderer);

    await catalogManagement.replaceCatalog('catalog.csv', 'name\nRose');
    await catalogManagement.getTemplate();
    await photos.importPhotos([{ name: 'rose.png', bytes: new Uint8Array() }]);
    await photos.deletePhoto('plant-1');

    expect(catalogRenderer.invoke.mock.calls).toEqual([
      [CATALOG_MANAGEMENT_CHANNELS.replace, 'catalog.csv', 'name\nRose'],
      [CATALOG_MANAGEMENT_CHANNELS.template],
    ]);
    expect(photoRenderer.invoke.mock.calls).toEqual([
      [PHOTO_CHANNELS.import, [{ name: 'rose.png', bytes: new Uint8Array() }]],
      [PHOTO_CHANNELS.delete, 'plant-1'],
    ]);
  });
});
