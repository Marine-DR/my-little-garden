import type {
  ExposureCode,
  Plant,
  PlantCatalogFilterOptions,
  PlantCatalogRepository,
  PlantPage,
  PlantPageRequest,
  PlantingSeasonCode,
  VocabularyValue,
} from '@my-little-garden/core';
import type { DatabaseSync } from 'node:sqlite';
import {
  CatalogQueries,
  type CatalogCodeRow,
  type CatalogValueRow,
} from './catalog-queries';

function requireNonEmpty<T>(
  values: T[],
  field: string,
  plantId: string,
): [T, ...T[]] {
  if (values.length === 0) {
    throw new Error(`Plant ${plantId} has no ${field}.`);
  }
  return values as [T, ...T[]];
}

function groupValues(
  rows: readonly CatalogValueRow[],
): Map<string, VocabularyValue[]> {
  const grouped = new Map<string, VocabularyValue[]>();
  for (const row of rows) {
    const values = grouped.get(row.plantId) ?? [];
    values.push({ id: row.id, label: row.label });
    grouped.set(row.plantId, values);
  }
  return grouped;
}

function groupCodes<T extends string>(
  rows: readonly CatalogCodeRow[],
): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const values = grouped.get(row.plantId) ?? [];
    values.push(row.value as T);
    grouped.set(row.plantId, values);
  }
  return grouped;
}

export class SqlitePlantCatalogRepository implements PlantCatalogRepository {
  private readonly queries: CatalogQueries;

  constructor(database: DatabaseSync) {
    this.queries = new CatalogQueries(database);
  }

  async list(request: PlantPageRequest): Promise<PlantPage> {
    const offset = Math.max(0, Math.trunc(request.offset));
    const limit = Math.max(1, Math.trunc(request.limit));
    const total = this.queries.total(request.filters);
    const rows = this.queries.page(limit, offset, request.filters);

    if (rows.length === 0) {
      return { items: [], total };
    }

    const ids = rows.map(({ id }) => id);
    const relationQueries = this.queries.relations(ids);
    const soils = groupValues(relationQueries.soils.all(...ids));
    const flowerColors = groupValues(relationQueries.flowerColors.all(...ids));
    const leafColors = groupValues(relationQueries.leafColors.all(...ids));
    const exposures = groupCodes<ExposureCode>(
      relationQueries.exposures.all(...ids),
    );
    const plantingSeasons = groupCodes<PlantingSeasonCode>(
      relationQueries.plantingSeasons.all(...ids),
    );

    const items: Plant[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      heightCm:
        row.heightMinCm === null && row.heightMaxCm === null
          ? null
          : { min: row.heightMinCm, max: row.heightMaxCm },
      type:
        row.typeId === null || row.typeLabel === null
          ? null
          : { id: row.typeId, label: row.typeLabel },
      kind: row.kind,
      soils: requireNonEmpty(soils.get(row.id) ?? [], 'soil', row.id),
      exposures: requireNonEmpty(
        exposures.get(row.id) ?? [],
        'exposure',
        row.id,
      ),
      bloom:
        row.bloomStartMonth === null || row.bloomEndMonth === null
          ? null
          : { startMonth: row.bloomStartMonth, endMonth: row.bloomEndMonth },
      flowerColors: flowerColors.get(row.id) ?? [],
      leafColors: leafColors.get(row.id) ?? [],
      minimumTemperatureCelsius: row.minimumTemperatureCelsius,
      foliagePersistence: row.foliagePersistence,
      spacingCm: row.spacingCm,
      plantingSeasons: plantingSeasons.get(row.id) ?? [],
      photo:
        row.managedFilename && row.mediaType && row.checksumSha256
          ? {
              managedFilename: row.managedFilename,
              mediaType: row.mediaType as NonNullable<
                Plant['photo']
              >['mediaType'],
              checksumSha256: row.checksumSha256,
            }
          : null,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt),
    }));

    return { items, total };
  }

  async listFilterOptions(): Promise<PlantCatalogFilterOptions> {
    return this.queries.filterOptions();
  }

  async listIds(filters?: PlantPageRequest['filters']): Promise<string[]> {
    return this.queries.ids(filters);
  }
}
