import type { Plant, PlantWriteInput } from './plant';

export interface PlantPageRequest {
  readonly offset: number;
  readonly limit: number;
}

export interface PlantPage {
  readonly items: readonly Plant[];
  readonly total: number;
}

/**
 * Persistence port. Implementations must save the plant, vocabulary values,
 * and relationship rows in one transaction.
 */
export interface PlantRepository {
  upsert(input: PlantWriteInput): Promise<Plant>;
  findById(id: string): Promise<Plant | null>;
  findByNormalizedName(normalizedName: string): Promise<Plant | null>;
  list(page: PlantPageRequest): Promise<PlantPage>;
}
