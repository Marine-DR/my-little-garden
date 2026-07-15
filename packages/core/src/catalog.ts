import { EXPOSURE_CODES } from './constants';
import type { ExposureCode } from './plant';

export const MONTH_NUMBERS: readonly number[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
] as const;

export interface PlantCatalogFilters {
  readonly soils?: readonly string[];
  readonly exposures?: readonly ExposureCode[];
  readonly bloomMonths?: readonly number[];
}

export interface PlantCatalogFilterOptions {
  readonly soils: readonly string[];
  readonly exposures: readonly ExposureCode[];
  readonly bloomMonths: readonly number[];
}

export function activeBloomMonths(start: number, end: number): number[] {
  if (!MONTH_NUMBERS.includes(start) || !MONTH_NUMBERS.includes(end)) {
    return [];
  }
  if (start <= end) {
    return MONTH_NUMBERS.filter((month) => month >= start && month <= end);
  }
  return [
    ...MONTH_NUMBERS.filter((month) => month >= start),
    ...MONTH_NUMBERS.filter((month) => month <= end),
  ];
}

export function sanitizeCatalogFilters(
  filters: PlantCatalogFilters | undefined,
): Required<PlantCatalogFilters> {
  return {
    soils: [...new Set(filters?.soils?.filter((value) => value.trim()) ?? [])],
    exposures: [
      ...new Set(
        filters?.exposures?.filter((value): value is ExposureCode =>
          EXPOSURE_CODES.includes(value),
        ) ?? [],
      ),
    ],
    bloomMonths: [
      ...new Set(
        filters?.bloomMonths
          ?.map((value) => Math.trunc(value))
          .filter((value) => MONTH_NUMBERS.includes(value)) ?? [],
      ),
    ],
  };
}
