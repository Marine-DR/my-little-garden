import type { PlantCatalogFilterOptions, PlantCatalogFilters } from './catalog';
import type { DataImportError } from './communication';
import type {
  ExposureCode,
  FoliagePersistence,
  PlantingSeasonCode,
} from './plant';

export interface CatalogPlant {
  readonly id: string;
  readonly name: string;
  readonly photoUrl: string | null;
  readonly heightMinCm: number | null;
  readonly heightMaxCm: number | null;
  readonly type: string | null;
  readonly kinds: readonly string[];
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
  readonly status: SelectionStatus;
  readonly modifiedPlantCount: number;
  readonly deletedPlantCount: number;
  readonly previewPhotoUrls: readonly (string | null)[];
  readonly plantCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type SelectionStatus =
  'up_to_date' | 'contains_modified_plants' | 'contains_deleted_plants';

export interface SelectionDetails {
  readonly id: string;
  readonly name: string;
  readonly status: SelectionStatus;
  readonly modifiedPlantCount: number;
  readonly deletedPlantCount: number;
  readonly modifiedPlants: readonly SelectionModifiedPlant[];
  readonly deletedPlants: readonly SelectionDeletedPlant[];
  readonly plants: readonly CatalogPlant[];
}

export interface SelectionDeletedPlant {
  readonly id: string;
  readonly name: string;
  readonly photoUrl: string | null;
}

export interface SelectionModifiedPlant {
  readonly id: string;
  readonly name: string;
  readonly attributes: readonly SelectionPlantAttributeChange[];
}

export interface SelectionPlantAttributeChange {
  readonly label: string;
  readonly before: string;
  readonly after: string;
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

export interface SelectionPlantAdditionInput {
  readonly selectionId: string;
  readonly plantIds: readonly string[];
}

export type SelectionPlantAdditionErrorCode =
  'no_selection' | 'no_plants' | 'selection_not_found' | 'unknown_plants';

export type SelectionPlantAdditionResult =
  | {
      readonly ok: true;
      readonly selectionId: string;
      readonly selectionName: string;
      readonly addedCount: number;
      readonly ignoredCount: number;
    }
  | {
      readonly ok: false;
      readonly code: SelectionPlantAdditionErrorCode;
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

type CatalogOperationFailure = {
  readonly ok: false;
  readonly errors: readonly CatalogImportError[];
};

type CatalogPreview = {
  readonly ok: true;
  readonly token: string;
  readonly unchanged: number;
};

type CatalogUpdateResult = {
  readonly ok: true;
  readonly created: number;
  readonly updated: number;
  readonly ignored: number;
  readonly notAdded: number;
};

export type CatalogAddPreviewResult =
  | (CatalogPreview & {
      readonly created: number;
      readonly conflicts: readonly string[];
      readonly impactedSelections: readonly CatalogModifyImpactedSelection[];
    })
  | CatalogOperationFailure;

export type CatalogAddResult =
  | (CatalogUpdateResult & {
      readonly alreadyExisted: number;
    })
  | CatalogOperationFailure;

export type CatalogModifyPreviewResult =
  | (CatalogPreview & {
      readonly updated: number;
      readonly missing: readonly string[];
      readonly impactedSelections: readonly CatalogModifyImpactedSelection[];
    })
  | CatalogOperationFailure;

export interface CatalogModifyImpactedSelection {
  readonly id: string;
  readonly name: string;
  readonly plantNames: readonly string[];
}

export interface PlantDeletionTarget {
  readonly id: string;
  readonly name: string;
}

export type PlantDeletionErrorCode = 'no_plants' | 'plants_not_found';

export type PlantDeletionPreviewResult =
  | {
      readonly ok: true;
      readonly plants: readonly PlantDeletionTarget[];
      readonly impactedSelections: readonly CatalogModifyImpactedSelection[];
    }
  | { readonly ok: false; readonly code: PlantDeletionErrorCode };

export type PlantDeletionResult =
  | {
      readonly ok: true;
      readonly deletedPlantCount: number;
      readonly affectedSelectionCount: number;
    }
  | { readonly ok: false; readonly code: PlantDeletionErrorCode };

export type CatalogModifyResult =
  | (CatalogUpdateResult & {
      readonly unchanged: number;
    })
  | CatalogOperationFailure;
