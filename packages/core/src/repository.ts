import type { Plant, PlantWriteInput } from './plant';
import type { PlantCatalogFilterOptions, PlantCatalogFilters } from './catalog';

export interface PlantPageRequest {
  readonly offset: number;
  readonly limit: number;
  readonly filters?: PlantCatalogFilters;
}

export interface PlantPage {
  readonly items: readonly Plant[];
  readonly total: number;
}

export interface PlantPhotoTarget {
  readonly plantId: string;
  readonly plantName: string;
  readonly managedFilename: string | null;
}

export interface PlantPhotoRecord {
  readonly plantId: string;
  readonly managedFilename: string;
  readonly mediaType: string;
  readonly checksumSha256: string;
  readonly createdAt: string;
}

export interface SelectionSummaryRecord {
  readonly id: string;
  readonly name: string;
  readonly previewManagedFilenames: readonly (string | null)[];
  readonly plantCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Persistence port. Implementations must save the plant, vocabulary values,
 * and relationship rows in one transaction.
 */
export interface PlantCatalogRepository {
  list(page: PlantPageRequest): Promise<PlantPage>;
  listFilterOptions(): Promise<PlantCatalogFilterOptions>;
}

export interface PlantRepository extends PlantCatalogRepository {
  upsert(input: PlantWriteInput): Promise<Plant>;
  findById(id: string): Promise<Plant | null>;
  findByNormalizedName(normalizedName: string): Promise<Plant | null>;
}

export interface PlantCatalogReplacementRepository {
  replace(plants: Iterable<PlantWriteInput>): number;
}

export interface PlantPhotoRepository {
  listTargets(): PlantPhotoTarget[];
  upsert(record: PlantPhotoRecord): void;
  deleteByPlantId(plantId: string): string | null;
}

export interface SelectionRepository {
  listSummaries(): Promise<SelectionSummaryRecord[]>;
}
