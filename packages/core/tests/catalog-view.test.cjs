const assert = require('node:assert/strict');
const test = require('node:test');
const { listCatalogPage, listSelectionSummaries } = require('../dist');

function plant(id, managedFilename = null) {
  return {
    id,
    name: `Plant ${id}`,
    heightCm: null,
    type: null,
    kinds: [],
    soils: [],
    exposures: [],
    bloom: null,
    flowerColors: [],
    leafColors: [],
    minimumTemperatureCelsius: null,
    foliagePersistence: null,
    spacingCm: null,
    plantingSeasons: [],
    photo: managedFilename
      ? {
          managedFilename,
          mediaType: 'image/png',
          checksumSha256: 'checksum',
        }
      : null,
  };
}

test('catalog-view clamps pagination and injects photo URL creation', async () => {
  const requests = [];
  const repository = {
    async list(request) {
      requests.push(request);
      return {
        total: 26,
        items: request.offset === 25 ? [plant('26', 'plant.png')] : [],
      };
    },
  };

  const page = await listCatalogPage(
    repository,
    (filename) => (filename ? `photo://${filename}` : null),
    99,
  );

  assert.deepEqual(requests, [
    { offset: 2450, limit: 25 },
    { offset: 25, limit: 25 },
  ]);
  assert.equal(page.page, 2);
  assert.equal(page.items[0].photoUrl, 'photo://plant.png');
});

test('catalog-view maps selection preview photos through the injected port', async () => {
  const repository = {
    async listSummaries() {
      return [
        {
          id: 'selection-1',
          name: 'Massif',
          status: 'up_to_date',
          modifiedPlantCount: 0,
          deletedPlantCount: 0,
          previewManagedFilenames: ['first.png', null],
          plantCount: 2,
          createdAt: '2026-08-15',
          updatedAt: '2026-08-15',
        },
      ];
    },
  };

  const summaries = await listSelectionSummaries(repository, (filename) =>
    filename ? `photo://${filename}` : null,
  );

  assert.deepEqual(summaries[0].previewPhotoUrls, ['photo://first.png', null]);
});
