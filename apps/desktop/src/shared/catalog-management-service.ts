import type {
  CatalogAddPreviewResult,
  CatalogAddResult,
  CatalogImportResult,
} from '@my-little-garden/core';

export const CATALOG_MANAGEMENT_CHANNELS = {
  replace: 'catalog:replace',
  addPreview: 'catalog:add-preview',
  addCommit: 'catalog:add-commit',
  template: 'catalog:template',
} as const;

export interface CatalogManagementService {
  replaceCatalog(filename: string, csv: string): Promise<CatalogImportResult>;
  previewCatalogAddition(
    filename: string,
    csv: string,
  ): Promise<CatalogAddPreviewResult>;
  commitCatalogAddition(
    token: string,
    policy: 'update_existing' | 'ignore_existing',
  ): Promise<CatalogAddResult>;
  getTemplate(): Promise<string>;
}
