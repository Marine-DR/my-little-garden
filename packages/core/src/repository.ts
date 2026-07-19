import type { Plant, PlantWriteInput } from './plant';
import type { PlantCatalogFilterOptions, PlantCatalogFilters } from './catalog';
import type {
  SelectionCreationInput,
  SelectionCreationResult,
} from './desktop-api';

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

export interface SelectionDetailsRecord {
  readonly id: string;
  readonly name: string;
  readonly plants: readonly Plant[];
}

export interface PlantCatalogRepository {
  list(page: PlantPageRequest): Promise<PlantPage>;
  listByIds(ids: readonly string[]): Promise<readonly Plant[]>;
  listIds(filters?: PlantCatalogFilters): Promise<string[]>;
  listFilterOptions(): Promise<PlantCatalogFilterOptions>;
}

/**
 * Persistence port. Implementations must save the plant, vocabulary values,
 * and relationship rows in one transaction.
 */
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
  get(selectionId: string): Promise<SelectionDetailsRecord | null>;
  create(input: SelectionCreationInput): Promise<SelectionCreationResult>;
}
