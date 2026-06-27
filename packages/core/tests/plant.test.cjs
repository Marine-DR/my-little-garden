const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeDatabaseKey,
  validatePlantWriteInput,
} = require('../dist/index.js');

function validPlant(overrides = {}) {
  return {
    id: 'b2ca6f19-8c52-4c2d-8e24-d3589c7a2b6f',
    name: 'Rosé ancienne',
    heightCm: { min: 40, max: 80 },
    typeLabel: 'Vivace',
    kind: 'flower',
    soilLabels: ['Drainé'],
    exposures: ['sun'],
    bloom: { startMonth: 5, endMonth: 9 },
    flowerColorLabels: ['Rose'],
    leafColorLabels: ['Vert'],
    minimumTemperatureC: -10,
    foliagePersistence: 'deciduous',
    spacingCm: 40,
    plantingSeasons: ['spring', 'autumn'],
    photo: null,
    ...overrides,
  };
}

test('normalizes case, diacritics, and repeated whitespace', () => {
  assert.equal(normalizeDatabaseKey('  ROSÉ   ancienne  '), 'rose ancienne');
});

test('accepts a complete valid plant', () => {
  assert.deepEqual(validatePlantWriteInput(validPlant()), []);
});

test('accepts a blooming period crossing the calendar year', () => {
  const plant = validPlant({ bloom: { startMonth: 11, endMonth: 2 } });
  assert.deepEqual(validatePlantWriteInput(plant), []);
});

test('requires name, soil, exposure, and valid bloom months', () => {
  const issues = validatePlantWriteInput(
    validPlant({
      name: '   ',
      soilLabels: [],
      exposures: [],
      bloom: { startMonth: 0, endMonth: 13 },
    }),
  );

  assert.deepEqual(
    new Set(issues.map(({ field }) => field)),
    new Set([
      'name',
      'soilLabels',
      'exposures',
      'bloom.startMonth',
      'bloom.endMonth',
    ]),
  );
});

test('rejects invalid measurements and duplicate normalized vocabularies', () => {
  const issues = validatePlantWriteInput(
    validPlant({
      heightCm: { min: 80, max: 40 },
      spacingCm: -1,
      soilLabels: ['Drainé', ' draine '],
      flowerColorLabels: ['Rosé', 'rose'],
    }),
  );

  assert.deepEqual(
    new Set(issues.map(({ field }) => field)),
    new Set(['heightCm', 'soilLabels', 'flowerColorLabels', 'spacingCm']),
  );
});
