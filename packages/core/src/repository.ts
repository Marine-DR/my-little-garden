import type { Plant, PlantWriteInput } from './plant';
import type { CatalogImportPlantRecord } from './catalog-replacement';
import type { PlantCatalogFilterOptions, PlantCatalogFilters } from './catalog';
import type {
  SelectionCreationInput,
  SelectionCreationResult,
  SelectionPlantAdditionInput,
  SelectionPlantAdditionResult,
  SelectionStatus,
  PlantDeletionResult,
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
  readonly status: SelectionStatus;
  readonly modifiedPlantCount: number;
  readonly deletedPlantCount: number;
  readonly previewManagedFilenames: readonly (string | null)[];
  readonly plantCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SelectionDetailsRecord {
  readonly id: string;
  readonly name: string;
  readonly status: SelectionStatus;
  readonly modifiedPlantCount: number;
  readonly deletedPlantCount: number;
  readonly modifiedPlants: readonly SelectionModifiedPlantRecord[];
  readonly deletedPlants: readonly SelectionDeletedPlantRecord[];
  readonly plants: readonly Plant[];
}

export interface SelectionModifiedPlantRecord {
  readonly id: string;
  readonly name: string;
  readonly baseline: Plant | null;
}

export interface SelectionDeletedPlantRecord {
  readonly id: string;
  readonly name: string;
  readonly managedFilename: string | null;
}

export interface SelectionPlantUsage {
  readonly selectionId: string;
  readonly selectionName: string;
  readonly plantId: string;
  readonly plantName: string;
}

/**
 * Persistence port. Implementations must save the plant, vocabulary values,
 * and relationship rows in one transaction.
 */
export interface PlantRepository {
  upsert(input: PlantWriteInput): Promise<Plant>;
  findById(id: string): Promise<Plant | null>;
  findByNormalizedName(normalizedName: string): Promise<Plant | null>;
}

export interface PlantCatalogRepository extends PlantRepository {
  list(page: PlantPageRequest): Promise<PlantPage>;
  listByIds(ids: readonly string[]): Promise<readonly Plant[]>;
  listIds(filters?: PlantCatalogFilters): Promise<string[]>;
  listFilterOptions(): Promise<PlantCatalogFilterOptions>;
}

export interface PlantCatalogReplacementRepository {
  replace(plants: Iterable<CatalogImportPlantRecord>): CatalogReplacementCommit;
}

/** Loads the current catalog state required to plan a full replacement. */
export interface PlantCatalogReplacementSnapshotRepository {
  listAllForReplacement(): readonly Plant[];
}

export interface CatalogReplacementCommit {
  readonly imported: number;
  readonly obsoleteManagedPhotoFilenames: readonly string[];
}

export interface IncrementalPlantCatalogRepository {
  findByNormalizedName(normalizedName: string): Promise<Plant | null>;
  listSelectionUsages(
    plantIds: readonly string[],
  ): Promise<readonly SelectionPlantUsage[]>;
  upsertImportedBatch(
    inputs: readonly PlantWriteInput[],
    modifiedPlants?: readonly Plant[],
  ): void;
  deletePlants(plantIds: readonly string[]): PlantDeletionResult;
}

export interface PlantPhotoRepository {
  listTargets(): PlantPhotoTarget[];
  upsert(record: PlantPhotoRecord): void;
  deleteByPlantId(plantId: string): string | null;
}

export interface SelectionRepository {
  listSummaries(): Promise<SelectionSummaryRecord[]>;
  deleteSelections(selectionIds: readonly string[]): Promise<number>;
  get(selectionId: string): Promise<SelectionDetailsRecord | null>;
  removePlants(
    selectionId: string,
    plantIds: readonly string[],
  ): Promise<SelectionDetailsRecord | null>;
  create(input: SelectionCreationInput): Promise<SelectionCreationResult>;
  addPlants(
    input: SelectionPlantAdditionInput,
  ): Promise<SelectionPlantAdditionResult>;
  acknowledgeModifiedPlants(
    selectionId: string,
  ): Promise<SelectionDetailsRecord | null>;
  acknowledgeDeletedPlants(
    selectionId: string,
  ): Promise<SelectionDetailsRecord | null>;
  listDeletedPhotoFilenames(selectionId: string): readonly string[];
  isPhotoFilenameReferenced(managedFilename: string): boolean;
}
