import type {
  PhotoImportFile,
  PhotoImportResult,
} from '@my-little-garden/photo-handling';

export type { PhotoImportFile, PhotoImportResult };

export interface CatalogPlant {
  readonly id: string;
  readonly name: string;
  readonly photoUrl: string | null;
  readonly heightMinCm: number | null;
  readonly heightMaxCm: number | null;
  readonly type: string | null;
  readonly kind: 'flower' | 'foliage' | 'grass' | 'other' | null;
  readonly soils: readonly string[];
  readonly exposures: readonly ('sun' | 'partial_shade' | 'shade')[];
  readonly bloomStartMonth: number | null;
  readonly bloomEndMonth: number | null;
  readonly flowerColors: readonly string[];
  readonly leafColors: readonly string[];
  readonly minimumTemperatureCelsius: number | null;
  readonly foliagePersistence:
    'evergreen' | 'semi_evergreen' | 'deciduous' | null;
  readonly spacingCm: number | null;
  readonly plantingSeasons: readonly (
    'spring' | 'summer' | 'autumn' | 'winter'
  )[];
}

export interface CatalogPage {
  readonly items: readonly CatalogPlant[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface CatalogFilters {
  readonly soils: readonly string[];
  readonly exposures: readonly CatalogPlant['exposures'][number][];
  readonly bloomMonths: readonly number[];
}

export interface CatalogFilterOptions {
  readonly soils: readonly string[];
  readonly exposures: readonly CatalogPlant['exposures'][number][];
  readonly bloomMonths: readonly number[];
}

export interface CatalogApi {
  listPlants(page: number, filters?: CatalogFilters): Promise<CatalogPage>;
  listFilterOptions(): Promise<CatalogFilterOptions>;
  replaceCatalog(filename: string, csv: string): Promise<CatalogImportResult>;
  importPhotos(files: readonly PhotoImportFile[]): Promise<PhotoImportResult>;
  deletePhoto(plantId: string): Promise<PhotoDeleteResult>;
}

export type PhotoDeleteResult =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

export interface CatalogImportError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}

export type CatalogImportResult =
  | { readonly ok: true; readonly imported: number }
  | { readonly ok: false; readonly errors: readonly CatalogImportError[] };
