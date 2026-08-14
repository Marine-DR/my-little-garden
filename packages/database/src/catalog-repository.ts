import type {
  ExposureCode,
  Plant,
  PlantCatalogFilterOptions,
  PlantCatalogRepository,
  PlantDeletionResult,
  PlantPage,
  PlantPageRequest,
  SelectionPlantUsage,
  PlantWriteInput,
  PlantingSeasonCode,
  VocabularyValue,
} from '@my-little-garden/core';
import type { DatabaseSync } from 'node:sqlite';
import {
  CatalogQueries,
  type CatalogCodeRow,
  type CatalogValueRow,
} from './catalog-queries';
import { CatalogWriter } from './catalog-writer';
import { upsertPlantPhotoQuery } from './plant-photo-queries';
import { inClausePlaceholders } from './query-builders';
import { recordDeletedPlantChanges } from './selection-change-writer';
import { runInTransaction } from './transaction';

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
  private readonly writer: CatalogWriter;

  constructor(private readonly database: DatabaseSync) {
    this.queries = new CatalogQueries(database);
    this.writer = new CatalogWriter(database);
  }

  async list(request: PlantPageRequest): Promise<PlantPage> {
    const offset = Math.max(0, Math.trunc(request.offset));
    const limit = Math.max(1, Math.trunc(request.limit));
    const total = this.queries.total(request.filters);
    const rows = this.queries.page(limit, offset, request.filters);

    return { items: this.hydrate(rows), total };
  }

  /** Synchronous snapshot used by the atomic full-catalog replacement. */
  listAllForReplacement(): readonly Plant[] {
    return this.hydrate(this.queries.page(2_147_483_647, 0));
  }

  async listByIds(ids: readonly string[]): Promise<readonly Plant[]> {
    return this.hydrate(this.queries.byIds([...new Set(ids)]));
  }

  async findById(id: string): Promise<Plant | null> {
    return (await this.listByIds([id]))[0] ?? null;
  }

  async findByNormalizedName(normalizedName: string): Promise<Plant | null> {
    return (
      this.hydrate(this.queries.byNormalizedName(normalizedName))[0] ?? null
    );
  }

  async upsert(input: PlantWriteInput): Promise<Plant> {
    const now = new Date().toISOString();
    runInTransaction(this.database, () => {
      this.writer.upsertPlant(input, now);
      this.writer.replaceRelations(input);
      this.upsertPhoto(input, now);
    });
    const plant = await this.findById(input.id);
    if (!plant) {
      throw new Error(`Plant ${input.id} could not be loaded after upsert.`);
    }
    return plant;
  }

  /** Imports complete CSV records atomically without replacing managed photos. */
  async listSelectionUsages(
    plantIds: readonly string[],
  ): Promise<readonly SelectionPlantUsage[]> {
    const ids = [...new Set(plantIds)];
    if (ids.length === 0) {
      return [];
    }
    const placeholders = inClausePlaceholders(ids.length);
    return this.database
      .prepare(
        `SELECT sp.selection_id, s.name AS selection_name, p.id AS plant_id,
                p.name AS plant_name
         FROM selection_plants sp
         JOIN selections s ON s.id = sp.selection_id
         JOIN plants p ON p.id = sp.plant_id
         WHERE sp.plant_id IN (${placeholders})
         ORDER BY s.name COLLATE NOCASE, s.id, p.name COLLATE NOCASE, p.id`,
      )
      .all(...ids)
      .map((row) => ({
        selectionId: String(row.selection_id),
        selectionName: String(row.selection_name),
        plantId: String(row.plant_id),
        plantName: String(row.plant_name),
      }));
  }

  upsertImportedBatch(
    inputs: readonly PlantWriteInput[],
    modifiedPlants: readonly Plant[] = [],
  ): void {
    const now = new Date().toISOString();
    runInTransaction(this.database, () => {
      if (modifiedPlants.length > 0) {
        const insertChange = this.database.prepare(
          `INSERT OR IGNORE INTO selection_plant_changes (
            selection_id, plant_id, change_kind, plant_name, baseline_json, created_at, updated_at
          )
          SELECT selection_id, ?, 'modified', ?, ?, ?, ?
          FROM selection_plants WHERE plant_id = ?`,
        );
        for (const plant of modifiedPlants) {
          insertChange.run(
            plant.id,
            plant.name,
            JSON.stringify(plant),
            now,
            now,
            plant.id,
          );
        }
      }
      for (const input of inputs) {
        this.writer.upsertPlant(input, now);
        this.writer.replaceRelations(input);
      }
    });
  }

  deletePlants(plantIds: readonly string[]): PlantDeletionResult {
    const ids = [...new Set(plantIds)];
    if (ids.length === 0) {
      return { ok: false, code: 'no_plants' };
    }

    return runInTransaction(this.database, () => {
      const placeholders = inClausePlaceholders(ids.length);
      const existing = this.database
        .prepare(`SELECT id FROM plants WHERE id IN (${placeholders})`)
        .all(...ids);
      if (existing.length !== ids.length) {
        return { ok: false, code: 'plants_not_found' };
      }

      const affectedSelectionCount = Number(
        (
          this.database
            .prepare(
              `SELECT count(DISTINCT selection_id) AS count
               FROM selection_plants WHERE plant_id IN (${placeholders})`,
            )
            .get(...ids) as { count: number | bigint }
        ).count,
      );
      const now = new Date().toISOString();
      recordDeletedPlantChanges(this.database, ids, now);
      this.database
        .prepare(`DELETE FROM plants WHERE id IN (${placeholders})`)
        .run(...ids);

      return {
        ok: true,
        deletedPlantCount: ids.length,
        affectedSelectionCount,
      };
    });
  }

  private hydrate(rows: ReturnType<CatalogQueries['page']>): Plant[] {
    if (rows.length === 0) {
      return [];
    }

    const ids = rows.map(({ id }) => id);
    const relationQueries = this.queries.relations(ids);
    const kinds = groupValues(relationQueries.kinds.all(...ids));
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
      kinds: kinds.get(row.id) ?? [],
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

    return items;
  }

  async listFilterOptions(): Promise<PlantCatalogFilterOptions> {
    return this.queries.filterOptions();
  }

  async listIds(filters?: PlantPageRequest['filters']): Promise<string[]> {
    return this.queries.ids(filters);
  }

  private upsertPhoto(plant: PlantWriteInput, now: string): void {
    if (!plant.photo) {
      this.database
        .prepare('DELETE FROM plant_photos WHERE plant_id = ?')
        .run(plant.id);
      return;
    }
    this.database
      .prepare(upsertPlantPhotoQuery)
      .run(
        plant.id,
        plant.photo.managedFilename,
        plant.photo.mediaType,
        plant.photo.checksumSha256,
        now,
      );
  }
}
