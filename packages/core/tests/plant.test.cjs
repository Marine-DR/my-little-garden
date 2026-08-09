const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeDatabaseKey,
  hasSameMaterialPlantRecord,
  validatePlantWriteInput,
  PlantWriteInputValidator,
} = require('../dist/index.js');

function validPlant(overrides = {}) {
  return {
    id: 'b2ca6f19-8c52-4c2d-8e24-d3589c7a2b6f',
    name: 'Rosé ancienne',
    heightCm: { min: 40, max: 80 },
    typeLabel: 'Vivace',
    kindLabels: ['Fleur', 'Arbuste'],
    soilLabels: ['Drainé'],
    exposures: ['sun'],
    bloom: { startMonth: 5, endMonth: 9 },
    flowerColorLabels: ['Rose'],
    leafColorLabels: ['Vert'],
    minimumTemperatureCelsius: -10,
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

test('preserves meaningful special characters in normalized names', () => {
  assert.equal(
    normalizeDatabaseKey("  L'ŒILLET—D'INDE & CIE.  "),
    "l'œillet—d'inde & cie.",
  );
});

test('accepts a complete valid plant', () => {
  assert.deepEqual(validatePlantWriteInput(validPlant()), []);
});

test('rejects duplicate normalized plant kind labels', () => {
  assert.deepEqual(
    validatePlantWriteInput(
      validPlant({ kindLabels: ['Plante grasse', 'plante grasse'] }),
    ).map(({ field, code }) => ({ field, code })),
    [{ field: 'kindLabels', code: 'duplicate_value' }],
  );
});

test('compares complete material records independently of technical fields', () => {
  const imported = validPlant();
  const existing = {
    id: 'existing-id',
    name: 'Rosé ancienne',
    heightCm: { min: 40, max: 80 },
    type: { id: 1, label: 'Vivace' },
    kinds: [
      { id: 4, label: 'Arbuste' },
      { id: 5, label: 'Fleur' },
    ],
    soils: [{ id: 1, label: 'Drainé' }],
    exposures: ['sun'],
    bloom: { startMonth: 5, endMonth: 9 },
    flowerColors: [{ id: 2, label: 'Rose' }],
    leafColors: [{ id: 3, label: 'Vert' }],
    minimumTemperatureCelsius: -10,
    foliagePersistence: 'deciduous',
    spacingCm: 40,
    plantingSeasons: ['spring', 'autumn'],
    photo: {
      managedFilename: 'rose.png',
      mediaType: 'image/png',
      checksumSha256: 'checksum',
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T00:00:00.000Z'),
  };

  assert.equal(hasSameMaterialPlantRecord(existing, imported), true);
  assert.equal(
    hasSameMaterialPlantRecord(existing, validPlant({ spacingCm: 50 })),
    false,
  );
});

test('uses a reusable validator service for core domain rules', () => {
  const validator = new PlantWriteInputValidator();
  const issues = validator.validate(
    validPlant({ name: '   ', soilLabels: [] }),
  );

  assert.deepEqual(
    issues.map(({ field }) => field),
    ['name', 'soilLabels'],
  );
});

test('supports composing validator rules through a reusable interface', () => {
  const validator = new PlantWriteInputValidator([
    {
      validate(plant, issues) {
        if (plant.name === 'Rosé ancienne') {
          issues.push({
            field: 'custom',
            code: 'custom_rule',
            message: 'custom rule applied',
          });
        }
      },
    },
  ]);

  const issues = validator.validate(validPlant());

  assert.deepEqual(
    issues.map(({ field }) => field),
    ['custom'],
  );
});

test('accepts a blooming period crossing the calendar year', () => {
  const plant = validPlant({ bloom: { startMonth: 11, endMonth: 2 } });
  assert.deepEqual(validatePlantWriteInput(plant), []);
});

test('accepts plants without bloom and with only a minimum height', () => {
  const plant = validPlant({ bloom: null, heightCm: { min: 42, max: null } });
  assert.deepEqual(validatePlantWriteInput(plant), []);
});

test('accepts plants with only a maximum height or no height', () => {
  assert.deepEqual(
    validatePlantWriteInput(validPlant({ heightCm: { min: null, max: 120 } })),
    [],
  );
  assert.deepEqual(validatePlantWriteInput(validPlant({ heightCm: null })), []);
});

test('requires name, soil, exposure, and validates provided bloom months', () => {
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

test('validates photo media types in the application layer', () => {
  const issues = validatePlantWriteInput(
    validPlant({
      photo: {
        managedFilename: 'plant-photo.avif',
        mediaType: 'image/avif',
        checksumSha256: 'a'.repeat(64),
      },
    }),
  );

  assert.deepEqual(
    issues.map(({ field }) => field),
    ['photo.mediaType'],
  );
});
