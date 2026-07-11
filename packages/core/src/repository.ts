import type { Plant, PlantWriteInput } from './plant';
import type { ExposureCode } from './plant';

export interface PlantPageRequest {
  readonly offset: number;
  readonly limit: number;
  readonly filters?: PlantCatalogFilters;
}

export interface PlantCatalogFilters {
  readonly soils?: readonly string[];
  readonly exposures?: readonly ExposureCode[];
  readonly bloomMonths?: readonly number[];
}

export interface PlantPage {
  readonly items: readonly Plant[];
  readonly total: number;
}

/**
 * Persistence port. Implementations must save the plant, vocabulary values,
 * and relationship rows in one transaction.
 */
export interface PlantCatalogRepository {
  list(page: PlantPageRequest): Promise<PlantPage>;
}

export interface PlantRepository extends PlantCatalogRepository {
  upsert(input: PlantWriteInput): Promise<Plant>;
  findById(id: string): Promise<Plant | null>;
  findByNormalizedName(normalizedName: string): Promise<Plant | null>;
}
