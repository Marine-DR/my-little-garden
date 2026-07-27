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

export interface PlantAttributeChange {
  readonly label: string;
  readonly before: string;
  readonly after: string;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (Array.isArray(value)) {
    return value.join(', ') || '-';
  }
  return String(value);
}

/** Produces the user-facing material differences retained for selection review. */
export function describePlantChanges(
  before: Plant,
  after: Plant,
): readonly PlantAttributeChange[] {
  const fields: readonly [string, unknown, unknown][] = [
    ['Nom', before.name, after.name],
    [
      'Hauteur',
      before.heightCm
        ? `${before.heightCm.min ?? '-'}–${before.heightCm.max ?? '-'} cm`
        : '-',
      after.heightCm
        ? `${after.heightCm.min ?? '-'}–${after.heightCm.max ?? '-'} cm`
        : '-',
    ],
    ['Type', before.type?.label, after.type?.label],
    [
      'Sol',
      before.soils.map(({ label }) => label),
      after.soils.map(({ label }) => label),
    ],
    ['Exposition', before.exposures, after.exposures],
    [
      'Floraison',
      before.bloom
        ? `${before.bloom.startMonth} → ${before.bloom.endMonth}`
        : '-',
      after.bloom ? `${after.bloom.startMonth} → ${after.bloom.endMonth}` : '-',
    ],
    [
      'Couleurs fleur',
      before.flowerColors.map(({ label }) => label),
      after.flowerColors.map(({ label }) => label),
    ],
    [
      'Couleurs feuille',
      before.leafColors.map(({ label }) => label),
      after.leafColors.map(({ label }) => label),
    ],
    [
      'Température minimum',
      before.minimumTemperatureCelsius === null
        ? '-'
        : `${before.minimumTemperatureCelsius} °C`,
      after.minimumTemperatureCelsius === null
        ? '-'
        : `${after.minimumTemperatureCelsius} °C`,
    ],
    ['Persistant', before.foliagePersistence, after.foliagePersistence],
    [
      'Espacement',
      before.spacingCm === null ? '-' : `${before.spacingCm} cm`,
      after.spacingCm === null ? '-' : `${after.spacingCm} cm`,
    ],
    ['Plantation', before.plantingSeasons, after.plantingSeasons],
  ];
  return fields.flatMap(([label, previous, current]) => {
    const beforeValue = displayValue(previous);
    const afterValue = displayValue(current);
    return beforeValue === afterValue
      ? []
      : [{ label, before: beforeValue, after: afterValue }];
  });
}

type MaterialPlantFields = Pick<
  PlantWriteInput,
  | 'name'
  | 'heightCm'
  | 'kind'
  | 'exposures'
  | 'bloom'
  | 'minimumTemperatureCelsius'
  | 'foliagePersistence'
  | 'spacingCm'
  | 'plantingSeasons'
>;

function normalizeLabels(
  labels: readonly string[] | readonly VocabularyValue[],
): string[] {
  return labels
    .map((label) =>
      normalizeDatabaseKey(typeof label === 'string' ? label : label.label),
    )
    .sort();
}

function materialRecord(
  input: MaterialPlantFields,
  typeLabel: string | null,
  soilLabels: readonly string[] | readonly VocabularyValue[],
  flowerColorLabels: readonly string[] | readonly VocabularyValue[],
  leafColorLabels: readonly string[] | readonly VocabularyValue[],
): string {
  return JSON.stringify({
    name: normalizeDatabaseKey(input.name),
    height: input.heightCm,
    type: typeLabel ? normalizeDatabaseKey(typeLabel) : null,
    kind: input.kind,
    soils: normalizeLabels(soilLabels),
    exposures: [...input.exposures].sort(),
    bloom: input.bloom,
    flowers: normalizeLabels(flowerColorLabels),
    leaves: normalizeLabels(leafColorLabels),
    temperature: input.minimumTemperatureCelsius,
    foliage: input.foliagePersistence,
    spacing: input.spacingCm,
    seasons: [...input.plantingSeasons].sort(),
  });
}

/**
 * Compares catalog records using their material fields only. Technical fields
 * and managed photos are deliberately excluded from CSV catalog maintenance.
 */
export function hasSameMaterialPlantRecord(
  existing: Plant,
  imported: PlantWriteInput,
): boolean {
  return (
    materialRecord(
      existing,
      existing.type?.label ?? null,
      existing.soils,
      existing.flowerColors,
      existing.leafColors,
    ) ===
    materialRecord(
      imported,
      imported.typeLabel,
      imported.soilLabels,
      imported.flowerColorLabels,
      imported.leafColorLabels,
    )
  );
}
