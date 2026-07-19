import type {
  ExposureCode,
  Plant,
  PlantCatalogFilterOptions,
  PlantCatalogRepository,
  PlantPage,
  PlantPageRequest,
  PlantWriteInput,
  PlantingSeasonCode,
  VocabularyValue,
} from '@my-little-garden/core';
import { normalizeDatabaseKey } from '@my-little-garden/core';
import type { DatabaseSync } from 'node:sqlite';
import {
  CatalogQueries,
  type CatalogCodeRow,
  type CatalogValueRow,
} from './catalog-queries';
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

function vocabularyId(
  database: DatabaseSync,
  table: 'plant_types' | 'soil_types' | 'colors',
  label: string,
): number {
  const normalized = normalizeDatabaseKey(label);
  const existing = database
    .prepare(`SELECT id FROM ${table} WHERE normalized_label = ?`)
    .get(normalized);
  if (existing) {
    return Number(existing.id);
  }
  const result = database
    .prepare(
      `INSERT INTO ${table} (label, normalized_label, created_at) VALUES (?, ?, ?) RETURNING id`,
    )
    .get(label, normalized, new Date().toISOString());
  return Number(result?.id);
}

export class SqlitePlantCatalogRepository implements PlantCatalogRepository {
  private readonly queries: CatalogQueries;

  constructor(private readonly database: DatabaseSync) {
    this.queries = new CatalogQueries(database);
  }

  async list(request: PlantPageRequest): Promise<PlantPage> {
    const offset = Math.max(0, Math.trunc(request.offset));
    const limit = Math.max(1, Math.trunc(request.limit));
    const total = this.queries.total(request.filters);
    const rows = this.queries.page(limit, offset, request.filters);

    return { items: this.hydrate(rows), total };
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
      this.upsertPlant(input, now);
      this.replaceRelations(input);
      this.upsertPhoto(input, now);
    });
    const plant = await this.findById(input.id);
    if (!plant) {
      throw new Error(`Plant ${input.id} could not be loaded after upsert.`);
    }
    return plant;
  }

  private hydrate(rows: ReturnType<CatalogQueries['page']>): Plant[] {
    if (rows.length === 0) {
      return [];
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

    return items;
  }

  async listFilterOptions(): Promise<PlantCatalogFilterOptions> {
    return this.queries.filterOptions();
  }

  async listIds(filters?: PlantPageRequest['filters']): Promise<string[]> {
    return this.queries.ids(filters);
  }

  private upsertPlant(plant: PlantWriteInput, now: string): void {
    this.database
      .prepare(
        `INSERT INTO plants (
          id, name, normalized_name, height_min_cm, height_max_cm, type_id, plant_kind,
          bloom_start_month, bloom_end_month, minimum_temperature_celsius,
          foliage_persistence, spacing_cm, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          normalized_name = excluded.normalized_name,
          height_min_cm = excluded.height_min_cm,
          height_max_cm = excluded.height_max_cm,
          type_id = excluded.type_id,
          plant_kind = excluded.plant_kind,
          bloom_start_month = excluded.bloom_start_month,
          bloom_end_month = excluded.bloom_end_month,
          minimum_temperature_celsius = excluded.minimum_temperature_celsius,
          foliage_persistence = excluded.foliage_persistence,
          spacing_cm = excluded.spacing_cm,
          updated_at = excluded.updated_at`,
      )
      .run(
        plant.id,
        plant.name,
        normalizeDatabaseKey(plant.name),
        plant.heightCm?.min ?? null,
        plant.heightCm?.max ?? null,
        plant.typeLabel
          ? vocabularyId(this.database, 'plant_types', plant.typeLabel)
          : null,
        plant.kind,
        plant.bloom?.startMonth ?? null,
        plant.bloom?.endMonth ?? null,
        plant.minimumTemperatureCelsius,
        plant.foliagePersistence,
        plant.spacingCm,
        now,
        now,
      );
  }

  private replaceRelations(plant: PlantWriteInput): void {
    const { id } = plant;
    this.database.prepare('DELETE FROM plant_soils WHERE plant_id = ?').run(id);
    this.database
      .prepare('DELETE FROM plant_exposures WHERE plant_id = ?')
      .run(id);
    this.database
      .prepare('DELETE FROM plant_flower_colors WHERE plant_id = ?')
      .run(id);
    this.database
      .prepare('DELETE FROM plant_leaf_colors WHERE plant_id = ?')
      .run(id);
    this.database
      .prepare('DELETE FROM plant_planting_seasons WHERE plant_id = ?')
      .run(id);

    for (const soil of plant.soilLabels) {
      this.database
        .prepare(
          'INSERT INTO plant_soils (plant_id, soil_type_id) VALUES (?, ?)',
        )
        .run(id, vocabularyId(this.database, 'soil_types', soil));
    }
    for (const code of plant.exposures) {
      this.database
        .prepare(
          'INSERT INTO plant_exposures (plant_id, exposure_code) VALUES (?, ?)',
        )
        .run(id, code);
    }
    for (const color of plant.flowerColorLabels) {
      this.database
        .prepare(
          'INSERT INTO plant_flower_colors (plant_id, color_id) VALUES (?, ?)',
        )
        .run(id, vocabularyId(this.database, 'colors', color));
    }
    for (const color of plant.leafColorLabels) {
      this.database
        .prepare(
          'INSERT INTO plant_leaf_colors (plant_id, color_id) VALUES (?, ?)',
        )
        .run(id, vocabularyId(this.database, 'colors', color));
    }
    for (const code of plant.plantingSeasons) {
      this.database
        .prepare(
          'INSERT INTO plant_planting_seasons (plant_id, season_code) VALUES (?, ?)',
        )
        .run(id, code);
    }
  }

  private upsertPhoto(plant: PlantWriteInput, now: string): void {
    if (!plant.photo) {
      this.database
        .prepare('DELETE FROM plant_photos WHERE plant_id = ?')
        .run(plant.id);
      return;
    }
    this.database
      .prepare(
        `INSERT INTO plant_photos
          (plant_id, managed_filename, media_type, checksum_sha256, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(plant_id) DO UPDATE SET
          managed_filename = excluded.managed_filename,
          media_type = excluded.media_type,
          checksum_sha256 = excluded.checksum_sha256,
          created_at = excluded.created_at`,
      )
      .run(
        plant.id,
        plant.photo.managedFilename,
        plant.photo.mediaType,
        plant.photo.checksumSha256,
        now,
      );
  }
}
