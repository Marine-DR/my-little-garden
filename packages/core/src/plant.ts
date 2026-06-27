export const EXPOSURE_CODES = ['sun', 'partial_shade', 'shade'] as const;
export type ExposureCode = (typeof EXPOSURE_CODES)[number];

export const PLANTING_SEASON_CODES = [
  'spring',
  'summer',
  'autumn',
  'winter',
] as const;
export type PlantingSeasonCode = (typeof PLANTING_SEASON_CODES)[number];

export const PLANT_KINDS = ['flower', 'foliage', 'grass', 'other'] as const;
export type PlantKind = (typeof PLANT_KINDS)[number];

export const FOLIAGE_PERSISTENCE_VALUES = [
  'evergreen',
  'semi_evergreen',
  'deciduous',
] as const;
export type FoliagePersistence =
  (typeof FOLIAGE_PERSISTENCE_VALUES)[number];

export const PHOTO_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export type PhotoMediaType = (typeof PHOTO_MEDIA_TYPES)[number];

export type NonEmptyArray<T> = readonly [T, ...T[]];

export interface VocabularyValue {
  readonly id: number;
  readonly label: string;
}

export interface PlantPhoto {
  readonly managedFilename: string;
  readonly originalFilename: string;
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
  readonly minimumTemperatureC: number | null;
  readonly foliagePersistence: FoliagePersistence | null;
  readonly spacingCm: number | null;
  readonly plantingSeasons: readonly PlantingSeasonCode[];
  readonly photo: PlantPhoto | null;
  readonly createdAt: string;
  readonly updatedAt: string;
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
  readonly minimumTemperatureC: number | null;
  readonly foliagePersistence: FoliagePersistence | null;
  readonly spacingCm: number | null;
  readonly plantingSeasons: readonly PlantingSeasonCode[];
  readonly photo: PlantPhoto | null;
}

