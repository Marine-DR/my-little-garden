import type {
  CatalogAddPreviewResult,
  CatalogAddResult,
  CatalogModifyPreviewResult,
  CatalogModifyResult,
  CatalogImportResult,
} from '@my-little-garden/core';

export const CATALOG_MANAGEMENT_CHANNELS = {
  replace: 'catalog:replace',
  addPreview: 'catalog:add-preview',
  addCommit: 'catalog:add-commit',
  modifyPreview: 'catalog:modify-preview',
  modifyCommit: 'catalog:modify-commit',
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
  previewCatalogModification(
    filename: string,
    csv: string,
  ): Promise<CatalogModifyPreviewResult>;
  commitCatalogModification(
    token: string,
    policy: 'create_missing' | 'ignore_missing',
  ): Promise<CatalogModifyResult>;
  getTemplate(): Promise<string>;
}
