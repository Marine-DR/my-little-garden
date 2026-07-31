import type {
  CatalogAddPreviewResult,
  CatalogAddResult,
  CatalogModifyPreviewResult,
  CatalogModifyResult,
  CatalogImportResult,
  PlantDeletionPreviewResult,
  PlantDeletionResult,
} from '@my-little-garden/core';

export const CATALOG_MANAGEMENT_CHANNELS = {
  replace: 'catalog:replace',
  addPreview: 'catalog:add-preview',
  addCommit: 'catalog:add-commit',
  modifyPreview: 'catalog:modify-preview',
  modifyCommit: 'catalog:modify-commit',
  deletePreview: 'catalog:delete-preview',
  deleteCommit: 'catalog:delete-commit',
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
  previewPlantDeletion(
    plantIds: readonly string[],
  ): Promise<PlantDeletionPreviewResult>;
  deletePlants(plantIds: readonly string[]): Promise<PlantDeletionResult>;
  getTemplate(): Promise<string>;
}
