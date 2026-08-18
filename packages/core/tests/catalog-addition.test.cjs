const assert = require('node:assert/strict');
const test = require('node:test');

const { CatalogAdditionService } = require('../dist/index.js');

function plantInput(overrides = {}) {
  return {
    id: 'new-rose',
    name: 'Rose',
    heightCm: { min: 40, max: 80 },
    typeLabel: 'Vivace',
    kindLabels: ['Fleur'],
    soilLabels: ['Drainé'],
    exposures: ['sun'],
    bloom: { startMonth: 5, endMonth: 9 },
    flowerColorLabels: ['Rose'],
    leafColorLabels: ['Vert'],
    minimumTemperatureCelsius: -10,
    foliagePersistence: 'deciduous',
    spacingCm: 40,
    plantingSeasons: ['spring'],
    photo: null,
    ...overrides,
  };
}

function storedPlant(overrides = {}) {
  return {
    id: 'existing-rose',
    name: 'Rose',
    heightCm: { min: 40, max: 80 },
    type: { id: 1, label: 'Vivace' },
    kinds: [{ id: 1, label: 'Fleur' }],
    soils: [{ id: 1, label: 'Drainé' }],
    exposures: ['sun'],
    bloom: { startMonth: 5, endMonth: 9 },
    flowerColors: [{ id: 1, label: 'Rose' }],
    leafColors: [{ id: 1, label: 'Vert' }],
    minimumTemperatureCelsius: -10,
    foliagePersistence: 'deciduous',
    spacingCm: 40,
    plantingSeasons: ['spring'],
    photo: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function repository(existingPlants = []) {
  const byName = new Map(
    existingPlants.map((plant) => [plant.name.toLocaleLowerCase('fr'), plant]),
  );
  return {
    commits: [],
    async findByNormalizedName(name) {
      return byName.get(name) ?? null;
    },
    async listSelectionUsages(plantIds) {
      return plantIds.includes('existing-rose')
        ? [
            {
              selectionId: 'selection-1',
              selectionName: 'Massif',
              plantId: 'existing-rose',
              plantName: 'Rose',
            },
          ]
        : [];
    },
    upsertImportedBatch(inputs, modifiedPlants = []) {
      this.commits.push({ inputs, modifiedPlants });
    },
  };
}

test('rejects duplicate normalized names before committing', async () => {
  const service = new CatalogAdditionService(repository());

  const result = await service.analyze([
    plantInput(),
    plantInput({ id: 'duplicate', name: ' rose ' }),
  ]);

  assert.deepEqual(result, [
    {
      code: 'duplicate_plant_name',
      message:
        'Le fichier contient plusieurs lignes pour la plante «  rose  ».',
    },
  ]);
});

test('analyzes additions, conflicts, unchanged records, and selection impacts', async () => {
  const existing = storedPlant();
  const repo = repository([
    existing,
    storedPlant({ id: 'existing-sage', name: 'Sauge' }),
  ]);
  const service = new CatalogAdditionService(repo);

  const result = await service.analyze([
    plantInput({ spacingCm: 50 }),
    plantInput({ id: 'new-sage', name: 'Sauge' }),
    plantInput({ id: 'new-aster', name: 'Aster' }),
  ]);

  assert.equal(Array.isArray(result), false);
  assert.equal(result.created, 1);
  assert.equal(result.unchanged, 1);
  assert.deepEqual(result.conflicts, ['Rose']);
  assert.deepEqual(result.impactedSelections, [
    { id: 'selection-1', name: 'Massif', plantNames: ['Rose'] },
  ]);
});

test('applies the selected existing-record policy with stable plant ids', async () => {
  const existing = storedPlant();
  const records = [
    plantInput({ spacingCm: 50 }),
    plantInput({ id: 'new-aster', name: 'Aster' }),
  ];
  const updateRepository = repository([existing]);
  const updateService = new CatalogAdditionService(updateRepository);
  const analysis = await updateService.analyze(records);
  assert.equal(Array.isArray(analysis), false);

  assert.deepEqual(updateService.commit(records, analysis, 'update_existing'), {
    ok: true,
    created: 1,
    updated: 1,
    ignored: 0,
    alreadyExisted: 0,
    notAdded: 0,
  });
  assert.deepEqual(updateRepository.commits[0].inputs, [
    plantInput({ id: 'existing-rose', spacingCm: 50 }),
    plantInput({ id: 'new-aster', name: 'Aster' }),
  ]);
  assert.deepEqual(updateRepository.commits[0].modifiedPlants, [existing]);

  const ignoreRepository = repository([existing]);
  const ignoreService = new CatalogAdditionService(ignoreRepository);
  const ignoreAnalysis = await ignoreService.analyze(records);
  assert.equal(Array.isArray(ignoreAnalysis), false);
  assert.deepEqual(
    ignoreService.commit(records, ignoreAnalysis, 'ignore_existing'),
    {
      ok: true,
      created: 1,
      updated: 0,
      ignored: 1,
      alreadyExisted: 0,
      notAdded: 1,
    },
  );
  assert.deepEqual(ignoreRepository.commits[0].inputs, [records[1]]);
  assert.deepEqual(ignoreRepository.commits[0].modifiedPlants, []);
});
