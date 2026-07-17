import type { CatalogApi } from '@my-little-garden/core';

declare global {
  interface Window {
    catalogApi: CatalogApi;
  }
}

export {};
