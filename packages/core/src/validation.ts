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

export interface PlantValidationRule {
  validate(plant: PlantWriteInput, issues: ValidationIssue[]): void;
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

function addIssue(
  issues: ValidationIssue[],
  field: string,
  code: string,
  message: string,
): void {
  issues.push({ field, code, message });
}

class IdentityValidationRule implements PlantValidationRule {
  validate(plant: PlantWriteInput, issues: ValidationIssue[]): void {
    if (!UUID_PATTERN.test(plant.id)) {
      addIssue(issues, 'id', 'invalid_uuid', 'Plant id must be a valid UUID.');
    }

    if (normalizeDatabaseKey(plant.name).length === 0) {
      addIssue(issues, 'name', 'required', 'Plant name is required.');
    }
  }
}

class DimensionsValidationRule implements PlantValidationRule {
  validate(plant: PlantWriteInput, issues: ValidationIssue[]): void {
    if (plant.heightCm !== null) {
      const { min, max } = plant.heightCm;
      if (min === null && max === null) {
        addIssue(
          issues,
          'heightCm',
          'required',
          'Height must include minimum or maximum.',
        );
      } else if (
        (min !== null && !Number.isInteger(min)) ||
        (max !== null && !Number.isInteger(max))
      ) {
        addIssue(
          issues,
          'heightCm',
          'not_integer',
          'Height values must be integers.',
        );
      } else if (
        (min !== null && min < 0) ||
        (max !== null && max < 0) ||
        (min !== null && max !== null && max < min)
      ) {
        addIssue(
          issues,
          'heightCm',
          'invalid_range',
          'Height must be non-negative and maximum must be at least minimum.',
        );
      }
    }

    if (
      plant.minimumTemperatureCelsius !== null &&
      !Number.isInteger(plant.minimumTemperatureCelsius)
    ) {
      addIssue(
        issues,
        'minimumTemperatureCelsius',
        'not_integer',
        'Minimum temperature must be an integer.',
      );
    }

    if (
      plant.spacingCm !== null &&
      (!Number.isInteger(plant.spacingCm) || plant.spacingCm < 0)
    ) {
      addIssue(
        issues,
        'spacingCm',
        'invalid_measurement',
        'Spacing must be a non-negative integer.',
      );
    }
  }
}

class VocabularyValidationRule implements PlantValidationRule {
  validate(plant: PlantWriteInput, issues: ValidationIssue[]): void {
    if (
      plant.typeLabel !== null &&
      normalizeDatabaseKey(plant.typeLabel).length === 0
    ) {
      addIssue(
        issues,
        'typeLabel',
        'empty_value',
        'Plant type cannot be blank.',
      );
    }

    if (plant.kind !== null && !PLANT_KINDS.includes(plant.kind)) {
      addIssue(
        issues,
        'kind',
        'unknown_constant',
        'Plant kind is not supported.',
      );
    }

    const normalizedSoils = plant.soilLabels.map(normalizeDatabaseKey);
    if (normalizedSoils.length === 0 || normalizedSoils.some((soil) => !soil)) {
      addIssue(
        issues,
        'soilLabels',
        'required',
        'At least one non-empty soil is required.',
      );
    } else if (hasDuplicates(plant.soilLabels)) {
      addIssue(
        issues,
        'soilLabels',
        'duplicate_value',
        'A soil may only appear once.',
      );
    }

    if (hasDuplicates(plant.flowerColorLabels)) {
      addIssue(
        issues,
        'flowerColorLabels',
        'duplicate_value',
        'A flower color may only appear once.',
      );
    }
    if (plant.flowerColorLabels.some((value) => !normalizeDatabaseKey(value))) {
      addIssue(
        issues,
        'flowerColorLabels',
        'empty_value',
        'Flower colors cannot be blank.',
      );
    }

    if (hasDuplicates(plant.leafColorLabels)) {
      addIssue(
        issues,
        'leafColorLabels',
        'duplicate_value',
        'A leaf color may only appear once.',
      );
    }
    if (plant.leafColorLabels.some((value) => !normalizeDatabaseKey(value))) {
      addIssue(
        issues,
        'leafColorLabels',
        'empty_value',
        'Leaf colors cannot be blank.',
      );
    }

    if (
      plant.foliagePersistence !== null &&
      !FOLIAGE_PERSISTENCE_VALUES.includes(plant.foliagePersistence)
    ) {
      addIssue(
        issues,
        'foliagePersistence',
        'unknown_constant',
        'Foliage persistence is not supported.',
      );
    }
  }
}

class CollectionsValidationRule implements PlantValidationRule {
  validate(plant: PlantWriteInput, issues: ValidationIssue[]): void {
    if (plant.exposures.length === 0) {
      addIssue(
        issues,
        'exposures',
        'required',
        'At least one exposure is required.',
      );
    } else {
      if (plant.exposures.some((value) => !EXPOSURE_CODES.includes(value))) {
        addIssue(
          issues,
          'exposures',
          'unknown_constant',
          'Exposure is not supported.',
        );
      }
      if (hasExactDuplicates(plant.exposures)) {
        addIssue(
          issues,
          'exposures',
          'duplicate_value',
          'An exposure may only appear once.',
        );
      }
    }

    if (plant.bloom !== null) {
      if (!isMonth(plant.bloom.startMonth)) {
        addIssue(
          issues,
          'bloom.startMonth',
          'invalid_month',
          'Bloom start must be 1 to 12.',
        );
      }
      if (!isMonth(plant.bloom.endMonth)) {
        addIssue(
          issues,
          'bloom.endMonth',
          'invalid_month',
          'Bloom end must be 1 to 12.',
        );
      }
    }

    if (
      plant.plantingSeasons.some(
        (value) => !PLANTING_SEASON_CODES.includes(value),
      )
    ) {
      addIssue(
        issues,
        'plantingSeasons',
        'unknown_constant',
        'Planting season is not supported.',
      );
    }
    if (hasExactDuplicates(plant.plantingSeasons)) {
      addIssue(
        issues,
        'plantingSeasons',
        'duplicate_value',
        'A planting season may only appear once.',
      );
    }
  }
}

class PhotoValidationRule implements PlantValidationRule {
  validate(plant: PlantWriteInput, issues: ValidationIssue[]): void {
    if (plant.photo !== null) {
      if (!plant.photo.managedFilename.trim()) {
        addIssue(
          issues,
          'photo.managedFilename',
          'required',
          'Managed filename is required.',
        );
      }
      if (!PHOTO_MEDIA_TYPES.includes(plant.photo.mediaType)) {
        addIssue(
          issues,
          'photo.mediaType',
          'unsupported_media',
          'Photo format is unsupported.',
        );
      }
      if (!SHA256_PATTERN.test(plant.photo.checksumSha256)) {
        addIssue(
          issues,
          'photo.checksumSha256',
          'invalid_checksum',
          'SHA-256 is invalid.',
        );
      }
    }
  }
}

const defaultRules: readonly PlantValidationRule[] = [
  new IdentityValidationRule(),
  new DimensionsValidationRule(),
  new VocabularyValidationRule(),
  new CollectionsValidationRule(),
  new PhotoValidationRule(),
];

export class PlantWriteInputValidator {
  constructor(
    private readonly rules: readonly PlantValidationRule[] = defaultRules,
  ) {}

  validate(plant: PlantWriteInput): readonly ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const rule of this.rules) {
      rule.validate(plant, issues);
    }

    return issues;
  }
}

const defaultValidator = new PlantWriteInputValidator();

export function validatePlantWriteInput(
  plant: PlantWriteInput,
): readonly ValidationIssue[] {
  return defaultValidator.validate(plant);
}
