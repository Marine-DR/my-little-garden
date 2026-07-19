import type {
  CatalogFilterOptions,
  CatalogFilters,
  CatalogPage,
} from '@my-little-garden/core';

export const CATALOG_CHANNELS = {
  list: 'catalog:list',
  listIds: 'catalog:list-ids',
  filterOptions: 'catalog:filter-options',
} as const;

export interface CatalogService {
  listPlants(page: number, filters?: CatalogFilters): Promise<CatalogPage>;
  listPlantIds(filters?: CatalogFilters): Promise<readonly string[]>;
  listFilterOptions(): Promise<CatalogFilterOptions>;
}
