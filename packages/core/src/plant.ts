import type {
  EXPOSURE_CODES,
  FOLIAGE_PERSISTENCE_VALUES,
  PHOTO_MEDIA_TYPES,
  PLANTING_SEASON_CODES,
  PLANT_KINDS,
} from './constants';
import type { NonEmptyArray } from './types';
import { normalizeDatabaseKey } from './normalization';

export type ExposureCode = (typeof EXPOSURE_CODES)[number];
export type PlantingSeasonCode = (typeof PLANTING_SEASON_CODES)[number];
export type PlantKind = (typeof PLANT_KINDS)[number];
export type FoliagePersistence = (typeof FOLIAGE_PERSISTENCE_VALUES)[number];
export type PhotoMediaType = (typeof PHOTO_MEDIA_TYPES)[number];

export interface VocabularyValue {
  readonly id: number;
  readonly label: string;
}

export interface PlantPhoto {
  readonly managedFilename: string;
  readonly mediaType: PhotoMediaType;
  readonly checksumSha256: string;
}

export interface Plant {
  readonly id: string;
  readonly name: string;
  readonly heightCm: {
    readonly min: number | null;
    readonly max: number | null;
  } | null;
  readonly type: VocabularyValue | null;
  readonly kind: PlantKind | null;
  readonly soils: NonEmptyArray<VocabularyValue>;
  readonly exposures: NonEmptyArray<ExposureCode>;
  readonly bloom: {
    readonly startMonth: number;
    readonly endMonth: number;
  } | null;
  readonly flowerColors: readonly VocabularyValue[];
  readonly leafColors: readonly VocabularyValue[];
  readonly minimumTemperatureCelsius: number | null;
  readonly foliagePersistence: FoliagePersistence | null;
  readonly spacingCm: number | null;
  readonly plantingSeasons: readonly PlantingSeasonCode[];
  readonly photo: PlantPhoto | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Write shape accepted by CSV import and application services before lookup
 * labels have been resolved to database identifiers.
 */
export interface PlantWriteInput {
  readonly id: string;
  readonly name: string;
  readonly heightCm: {
    readonly min: number | null;
    readonly max: number | null;
  } | null;
  readonly typeLabel: string | null;
  readonly kind: PlantKind | null;
  readonly soilLabels: readonly string[];
  readonly exposures: readonly ExposureCode[];
  readonly bloom: {
    readonly startMonth: number;
    readonly endMonth: number;
  } | null;
  readonly flowerColorLabels: readonly string[];
  readonly leafColorLabels: readonly string[];
  readonly minimumTemperatureCelsius: number | null;
  readonly foliagePersistence: FoliagePersistence | null;
  readonly spacingCm: number | null;
  readonly plantingSeasons: readonly PlantingSeasonCode[];
  readonly photo: PlantPhoto | null;
}

/**
 * Compares catalog records using their material fields only. Technical fields
 * and managed photos are deliberately excluded from CSV catalog maintenance.
 */
export function hasSameMaterialPlantRecord(
  existing: Plant,
  imported: PlantWriteInput,
): boolean {
  const materialRecord = (input: Plant | PlantWriteInput): string => {
    const values =
      'typeLabel' in input
        ? {
            name: normalizeDatabaseKey(input.name),
            height: input.heightCm,
            type: input.typeLabel
              ? normalizeDatabaseKey(input.typeLabel)
              : null,
            kind: input.kind,
            soils: input.soilLabels.map(normalizeDatabaseKey).sort(),
            exposures: [...input.exposures].sort(),
            bloom: input.bloom,
            flowers: input.flowerColorLabels.map(normalizeDatabaseKey).sort(),
            leaves: input.leafColorLabels.map(normalizeDatabaseKey).sort(),
            temperature: input.minimumTemperatureCelsius,
            foliage: input.foliagePersistence,
            spacing: input.spacingCm,
            seasons: [...input.plantingSeasons].sort(),
          }
        : {
            name: normalizeDatabaseKey(input.name),
            height: input.heightCm,
            type: input.type?.label
              ? normalizeDatabaseKey(input.type.label)
              : null,
            kind: input.kind,
            soils: input.soils
              .map(({ label }) => normalizeDatabaseKey(label))
              .sort(),
            exposures: [...input.exposures].sort(),
            bloom: input.bloom,
            flowers: input.flowerColors
              .map(({ label }) => normalizeDatabaseKey(label))
              .sort(),
            leaves: input.leafColors
              .map(({ label }) => normalizeDatabaseKey(label))
              .sort(),
            temperature: input.minimumTemperatureCelsius,
            foliage: input.foliagePersistence,
            spacing: input.spacingCm,
            seasons: [...input.plantingSeasons].sort(),
          };
    return JSON.stringify(values);
  };

  return materialRecord(existing) === materialRecord(imported);
}
