import type { CatalogImportResult } from '@my-little-garden/core';

export const CATALOG_MANAGEMENT_CHANNELS = {
  replace: 'catalog:replace',
} as const;

export interface CatalogManagementService {
  replaceCatalog(filename: string, csv: string): Promise<CatalogImportResult>;
}
