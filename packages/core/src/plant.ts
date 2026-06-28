import type {
  EXPOSURE_CODES,
  FOLIAGE_PERSISTENCE_VALUES,
  PHOTO_MEDIA_TYPES,
  PLANTING_SEASON_CODES,
  PLANT_KINDS,
} from './constants';
import type { NonEmptyArray } from './types';

export type ExposureCode = (typeof EXPOSURE_CODES)[number];
export type PlantingSeasonCode = (typeof PLANTING_SEASON_CODES)[number];
export type PlantKind = (typeof PLANT_KINDS)[number];
export type FoliagePersistence =
  (typeof FOLIAGE_PERSISTENCE_VALUES)[number];
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
  readonly heightCm: { readonly min: number; readonly max: number } | null;
  readonly type: VocabularyValue | null;
  readonly kind: PlantKind | null;
  readonly soils: NonEmptyArray<VocabularyValue>;
  readonly exposures: NonEmptyArray<ExposureCode>;
  readonly bloom: {
    readonly startMonth: number;
    readonly endMonth: number;
  };
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
  readonly heightCm: { readonly min: number; readonly max: number } | null;
  readonly typeLabel: string | null;
  readonly kind: PlantKind | null;
  readonly soilLabels: readonly string[];
  readonly exposures: readonly ExposureCode[];
  readonly bloom: {
    readonly startMonth: number;
    readonly endMonth: number;
  };
  readonly flowerColorLabels: readonly string[];
  readonly leafColorLabels: readonly string[];
  readonly minimumTemperatureCelsius: number | null;
  readonly foliagePersistence: FoliagePersistence | null;
  readonly spacingCm: number | null;
  readonly plantingSeasons: readonly PlantingSeasonCode[];
  readonly photo: PlantPhoto | null;
}
