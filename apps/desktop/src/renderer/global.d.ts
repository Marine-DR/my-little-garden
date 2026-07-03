import type { CatalogApi } from '../shared/catalog';

declare global {
  interface Window {
    catalogApi: CatalogApi;
  }
}

export {};
