import {
  EXPOSURE_CODES,
  FOLIAGE_PERSISTENCE_VALUES,
  PHOTO_MEDIA_TYPES,
  PLANTING_SEASON_CODES,
  PLANT_KINDS,
} from './constants';
import type { PlantWriteInput } from './plant';
import { normalizeDatabaseKey } from './normalization';

export interface ValidationIssue {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SHA256_PATTERN = /^[0-9a-f]{64}$/iu;

function isMonth(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

function hasDuplicates(values: readonly string[]): boolean {
  const normalizedValues = values.map(normalizeDatabaseKey);
  return new Set(normalizedValues).size !== normalizedValues.length;
}

function hasExactDuplicates(values: readonly string[]): boolean {
  return new Set(values).size !== values.length;
}

export function validatePlantWriteInput(
  plant: PlantWriteInput,
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (field: string, code: string, message: string): void => {
    issues.push({ field, code, message });
  };

  if (!UUID_PATTERN.test(plant.id)) {
    add('id', 'invalid_uuid', 'Plant id must be a valid UUID.');
  }

  if (normalizeDatabaseKey(plant.name).length === 0) {
    add('name', 'required', 'Plant name is required.');
  }

  if (plant.heightCm !== null) {
    const { min, max } = plant.heightCm;
    if (min === null && max === null) {
      add('heightCm', 'required', 'Height must include minimum or maximum.');
    } else if (
      (min !== null && !Number.isInteger(min)) ||
      (max !== null && !Number.isInteger(max))
    ) {
      add('heightCm', 'not_integer', 'Height values must be integers.');
    } else if (
      (min !== null && min < 0) ||
      (max !== null && max < 0) ||
      (min !== null && max !== null && max < min)
    ) {
      add(
        'heightCm',
        'invalid_range',
        'Height must be non-negative and maximum must be at least minimum.',
      );
    }
  }

  if (
    plant.typeLabel !== null &&
    normalizeDatabaseKey(plant.typeLabel).length === 0
  ) {
    add('typeLabel', 'empty_value', 'Plant type cannot be blank.');
  }

  if (plant.kind !== null && !PLANT_KINDS.includes(plant.kind)) {
    add('kind', 'unknown_constant', 'Plant kind is not supported.');
  }

  const normalizedSoils = plant.soilLabels.map(normalizeDatabaseKey);
  if (normalizedSoils.length === 0 || normalizedSoils.some((soil) => !soil)) {
    add('soilLabels', 'required', 'At least one non-empty soil is required.');
  } else if (hasDuplicates(plant.soilLabels)) {
    add('soilLabels', 'duplicate_value', 'A soil may only appear once.');
  }

  if (plant.exposures.length === 0) {
    add('exposures', 'required', 'At least one exposure is required.');
  } else {
    if (plant.exposures.some((value) => !EXPOSURE_CODES.includes(value))) {
      add('exposures', 'unknown_constant', 'Exposure is not supported.');
    }
    if (hasExactDuplicates(plant.exposures)) {
      add('exposures', 'duplicate_value', 'An exposure may only appear once.');
    }
  }

  if (plant.bloom !== null) {
    if (!isMonth(plant.bloom.startMonth)) {
      add('bloom.startMonth', 'invalid_month', 'Bloom start must be 1 to 12.');
    }
    if (!isMonth(plant.bloom.endMonth)) {
      add('bloom.endMonth', 'invalid_month', 'Bloom end must be 1 to 12.');
    }
  }

  if (hasDuplicates(plant.flowerColorLabels)) {
    add(
      'flowerColorLabels',
      'duplicate_value',
      'A flower color may only appear once.',
    );
  }
  if (plant.flowerColorLabels.some((value) => !normalizeDatabaseKey(value))) {
    add('flowerColorLabels', 'empty_value', 'Flower colors cannot be blank.');
  }

  if (hasDuplicates(plant.leafColorLabels)) {
    add(
      'leafColorLabels',
      'duplicate_value',
      'A leaf color may only appear once.',
    );
  }
  if (plant.leafColorLabels.some((value) => !normalizeDatabaseKey(value))) {
    add('leafColorLabels', 'empty_value', 'Leaf colors cannot be blank.');
  }

  if (
    plant.minimumTemperatureCelsius !== null &&
    !Number.isInteger(plant.minimumTemperatureCelsius)
  ) {
    add(
      'minimumTemperatureCelsius',
      'not_integer',
      'Minimum temperature must be an integer.',
    );
  }

  if (
    plant.foliagePersistence !== null &&
    !FOLIAGE_PERSISTENCE_VALUES.includes(plant.foliagePersistence)
  ) {
    add(
      'foliagePersistence',
      'unknown_constant',
      'Foliage persistence is not supported.',
    );
  }

  if (
    plant.spacingCm !== null &&
    (!Number.isInteger(plant.spacingCm) || plant.spacingCm < 0)
  ) {
    add(
      'spacingCm',
      'invalid_measurement',
      'Spacing must be a non-negative integer.',
    );
  }

  if (
    plant.plantingSeasons.some(
      (value) => !PLANTING_SEASON_CODES.includes(value),
    )
  ) {
    add(
      'plantingSeasons',
      'unknown_constant',
      'Planting season is not supported.',
    );
  }
  if (hasExactDuplicates(plant.plantingSeasons)) {
    add(
      'plantingSeasons',
      'duplicate_value',
      'A planting season may only appear once.',
    );
  }

  if (plant.photo !== null) {
    if (!plant.photo.managedFilename.trim()) {
      add('photo.managedFilename', 'required', 'Managed filename is required.');
    }
    if (!PHOTO_MEDIA_TYPES.includes(plant.photo.mediaType)) {
      add(
        'photo.mediaType',
        'unsupported_media',
        'Photo format is unsupported.',
      );
    }
    if (!SHA256_PATTERN.test(plant.photo.checksumSha256)) {
      add('photo.checksumSha256', 'invalid_checksum', 'SHA-256 is invalid.');
    }
  }

  return issues;
}
