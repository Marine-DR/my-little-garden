import type {
  CatalogFilters,
  CatalogPage,
  CatalogPlant,
  Plant,
  PlantCatalogRepository,
  SelectionRepository,
  SelectionDetails,
  SelectionDetailsRecord,
  SelectionPlantAttributeChange,
  SelectionSummary,
  SelectionSummaryRecord,
} from '@my-little-garden/core';
import { createPhotoUrl } from '@my-little-garden/photo-handling';
import { rmSync } from 'node:fs';
import { join } from 'node:path';

const CATALOG_PAGE_SIZE = 25;

export async function listCatalogPage(
  catalogRepository: PlantCatalogRepository,
  requestedPage: number,
  filters?: CatalogFilters,
): Promise<CatalogPage> {
  const normalizedPage = Math.max(1, Math.trunc(requestedPage) || 1);
  let result = await catalogRepository.list({
    offset: (normalizedPage - 1) * CATALOG_PAGE_SIZE,
    limit: CATALOG_PAGE_SIZE,
    filters,
  });
  const pageCount = Math.max(1, Math.ceil(result.total / CATALOG_PAGE_SIZE));
  const page = Math.min(normalizedPage, pageCount);
  if (page !== normalizedPage) {
    result = await catalogRepository.list({
      offset: (page - 1) * CATALOG_PAGE_SIZE,
      limit: CATALOG_PAGE_SIZE,
      filters,
    });
  }
  return {
    items: result.items.map(toCatalogPlant),
    page,
    pageSize: CATALOG_PAGE_SIZE,
    total: result.total,
  };
}

export async function listSelectionSummaries(
  selectionRepository: SelectionRepository,
): Promise<readonly SelectionSummary[]> {
  return (await selectionRepository.listSummaries()).map(toSelectionSummary);
}

export async function getSelectionDetails(
  selectionRepository: SelectionRepository,
  selectionId: string,
): Promise<SelectionDetails | null> {
  const selection = await selectionRepository.get(selectionId);
  if (!selection) {
    return null;
  }
  return toSelectionDetails(selection);
}

export async function removePlantsFromSelection(
  selectionRepository: SelectionRepository,
  selectionId: string,
  plantIds: readonly string[],
): Promise<SelectionDetails | null> {
  const selection = await selectionRepository.removePlants(
    selectionId,
    plantIds,
  );
  if (!selection) {
    return null;
  }
  return toSelectionDetails(selection);
}

export async function acknowledgeModifiedSelectionPlants(
  selectionRepository: SelectionRepository,
  selectionId: string,
): Promise<SelectionDetails | null> {
  const selection =
    await selectionRepository.acknowledgeModifiedPlants(selectionId);
  if (!selection) {
    return null;
  }
  return toSelectionDetails(selection);
}

export async function acknowledgeDeletedSelectionPlants(
  selectionRepository: SelectionRepository,
  selectionId: string,
  photoDirectory: string,
): Promise<SelectionDetails | null> {
  const filenames = selectionRepository.listDeletedPhotoFilenames(selectionId);
  const selection =
    await selectionRepository.acknowledgeDeletedPlants(selectionId);
  if (selection) {
    for (const filename of filenames) {
      if (!selectionRepository.isPhotoFilenameReferenced(filename)) {
        rmSync(join(photoDirectory, filename), { force: true });
      }
    }
  }
  return selection ? toSelectionDetails(selection) : null;
}

function toSelectionDetails(
  selection: SelectionDetailsRecord,
): SelectionDetails {
  return {
    id: selection.id,
    name: selection.name,
    status: selection.status,
    modifiedPlantCount: selection.modifiedPlantCount,
    deletedPlantCount: selection.deletedPlantCount,
    modifiedPlants: selection.modifiedPlants.map((modifiedPlant) => {
      const currentPlant = selection.plants.find(
        ({ id }) => id === modifiedPlant.id,
      );
      return {
        id: modifiedPlant.id,
        name: modifiedPlant.name,
        attributes:
          modifiedPlant.baseline && currentPlant
            ? describePlantChanges(modifiedPlant.baseline, currentPlant)
            : [],
      };
    }),
    deletedPlants: selection.deletedPlants.map((deletedPlant) => ({
      id: deletedPlant.id,
      name: deletedPlant.name,
      photoUrl: createPhotoUrl(deletedPlant.managedFilename),
    })),
    plants: selection.plants.map(toCatalogPlant),
  };
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  if (Array.isArray(value)) {
    return value.join(', ') || '-';
  }
  return String(value);
}

function describePlantChanges(
  before: Plant,
  after: Plant,
): readonly SelectionPlantAttributeChange[] {
  const fields: readonly [string, unknown, unknown][] = [
    ['Nom', before.name, after.name],
    [
      'Hauteur',
      before.heightCm
        ? `${before.heightCm.min ?? '-'}–${before.heightCm.max ?? '-'} cm`
        : '-',
      after.heightCm
        ? `${after.heightCm.min ?? '-'}–${after.heightCm.max ?? '-'} cm`
        : '-',
    ],
    ['Type', before.type?.label, after.type?.label],
    [
      'Sol',
      before.soils.map(({ label }) => label),
      after.soils.map(({ label }) => label),
    ],
    ['Exposition', before.exposures, after.exposures],
    [
      'Floraison',
      before.bloom
        ? `${before.bloom.startMonth} → ${before.bloom.endMonth}`
        : '-',
      after.bloom ? `${after.bloom.startMonth} → ${after.bloom.endMonth}` : '-',
    ],
    [
      'Couleurs fleur',
      before.flowerColors.map(({ label }) => label),
      after.flowerColors.map(({ label }) => label),
    ],
    [
      'Couleurs feuille',
      before.leafColors.map(({ label }) => label),
      after.leafColors.map(({ label }) => label),
    ],
    [
      'Température minimum',
      before.minimumTemperatureCelsius === null
        ? '-'
        : `${before.minimumTemperatureCelsius} °C`,
      after.minimumTemperatureCelsius === null
        ? '-'
        : `${after.minimumTemperatureCelsius} °C`,
    ],
    ['Persistant', before.foliagePersistence, after.foliagePersistence],
    [
      'Espacement',
      before.spacingCm === null ? '-' : `${before.spacingCm} cm`,
      after.spacingCm === null ? '-' : `${after.spacingCm} cm`,
    ],
    ['Plantation', before.plantingSeasons, after.plantingSeasons],
  ];
  return fields.flatMap(([label, previous, current]) => {
    const beforeValue = displayValue(previous);
    const afterValue = displayValue(current);
    return beforeValue === afterValue
      ? []
      : [{ label, before: beforeValue, after: afterValue }];
  });
}

function toCatalogPlant(plant: Plant): CatalogPlant {
  return {
    id: plant.id,
    name: plant.name,
    photoUrl: createPhotoUrl(plant.photo?.managedFilename ?? null),
    heightMinCm: plant.heightCm?.min ?? null,
    heightMaxCm: plant.heightCm?.max ?? null,
    type: plant.type?.label ?? null,
    kind: plant.kind,
    soils: plant.soils.map(({ label }) => label),
    exposures: plant.exposures,
    bloomStartMonth: plant.bloom?.startMonth ?? null,
    bloomEndMonth: plant.bloom?.endMonth ?? null,
    flowerColors: plant.flowerColors.map(({ label }) => label),
    leafColors: plant.leafColors.map(({ label }) => label),
    minimumTemperatureCelsius: plant.minimumTemperatureCelsius,
    foliagePersistence: plant.foliagePersistence,
    spacingCm: plant.spacingCm,
    plantingSeasons: plant.plantingSeasons,
  };
}

function toSelectionSummary(
  selection: SelectionSummaryRecord,
): SelectionSummary {
  return {
    id: selection.id,
    name: selection.name,
    status: selection.status,
    modifiedPlantCount: selection.modifiedPlantCount,
    deletedPlantCount: selection.deletedPlantCount,
    previewPhotoUrls: selection.previewManagedFilenames.map((filename) =>
      createPhotoUrl(filename),
    ),
    plantCount: selection.plantCount,
    createdAt: selection.createdAt,
    updatedAt: selection.updatedAt,
  };
}
