import type {
  CatalogFilters,
  CatalogPage,
  CatalogPlant,
  Plant,
  PlantCatalogRepository,
  SelectionRepository,
  SelectionSummary,
  SelectionSummaryRecord,
} from '@my-little-garden/core';
import { createPhotoUrl } from '@my-little-garden/photo-handling';

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
    previewPhotoUrls: selection.previewManagedFilenames.map((filename) =>
      createPhotoUrl(filename),
    ),
    plantCount: selection.plantCount,
    createdAt: selection.createdAt,
    updatedAt: selection.updatedAt,
  };
}
