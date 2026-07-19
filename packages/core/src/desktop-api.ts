import type { PlantCatalogFilterOptions, PlantCatalogFilters } from './catalog';
import type { DataImportError } from './communication';
import type {
  ExposureCode,
  FoliagePersistence,
  PlantKind,
  PlantingSeasonCode,
} from './plant';

export interface CatalogPlant {
  readonly id: string;
  readonly name: string;
  readonly photoUrl: string | null;
  readonly heightMinCm: number | null;
  readonly heightMaxCm: number | null;
  readonly type: string | null;
  readonly kind: PlantKind | null;
  readonly soils: readonly string[];
  readonly exposures: readonly ExposureCode[];
  readonly bloomStartMonth: number | null;
  readonly bloomEndMonth: number | null;
  readonly flowerColors: readonly string[];
  readonly leafColors: readonly string[];
  readonly minimumTemperatureCelsius: number | null;
  readonly foliagePersistence: FoliagePersistence | null;
  readonly spacingCm: number | null;
  readonly plantingSeasons: readonly PlantingSeasonCode[];
}

export interface CatalogPage {
  readonly items: readonly CatalogPlant[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

export interface SelectionSummary {
  readonly id: string;
  readonly name: string;
  readonly previewPhotoUrls: readonly (string | null)[];
  readonly plantCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SelectionDetails {
  readonly id: string;
  readonly name: string;
  readonly plants: readonly CatalogPlant[];
}

export interface SelectionCreationInput {
  readonly name: string;
  readonly plantIds: readonly string[];
}

export type SelectionCreationErrorCode =
  'empty_name' | 'no_plants' | 'duplicate_name' | 'unknown_plants';

export type SelectionCreationResult =
  | {
      readonly ok: true;
      readonly selectionId: string;
      readonly name: string;
      readonly plantCount: number;
    }
  | {
      readonly ok: false;
      readonly code: SelectionCreationErrorCode;
    };

export type CatalogFilters = Required<PlantCatalogFilters>;

export type CatalogFilterOptions = PlantCatalogFilterOptions;

export interface PhotoImportFile {
  readonly name: string;
  readonly bytes: Uint8Array;
}

export interface PhotoImportError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}

export type PhotoImportResult =
  | {
      readonly ok: true;
      readonly imported: number;
      readonly unmatched: readonly string[];
    }
  | { readonly ok: false; readonly errors: readonly PhotoImportError[] };

export type PhotoDeleteResult =
  { readonly ok: true } | { readonly ok: false; readonly error: string };

export type CatalogImportError = DataImportError;

export type CatalogImportResult =
  | { readonly ok: true; readonly imported: number }
  | { readonly ok: false; readonly errors: readonly CatalogImportError[] };

export interface CatalogApi {
  listPlants(page: number, filters?: CatalogFilters): Promise<CatalogPage>;
  listPlantIds(filters?: CatalogFilters): Promise<readonly string[]>;
  listFilterOptions(): Promise<CatalogFilterOptions>;
  listSelections(): Promise<readonly SelectionSummary[]>;
  getSelection(selectionId: string): Promise<SelectionDetails | null>;
  createSelection(
    input: SelectionCreationInput,
  ): Promise<SelectionCreationResult>;
  replaceCatalog(filename: string, csv: string): Promise<CatalogImportResult>;
  importPhotos(files: readonly PhotoImportFile[]): Promise<PhotoImportResult>;
  deletePhoto(plantId: string): Promise<PhotoDeleteResult>;
}
