import type {
  ExposureCode,
  FoliagePersistence,
  Plant,
  PlantCatalogRepository,
  PlantKind,
  PlantPage,
  PlantPageRequest,
  PlantingSeasonCode,
  VocabularyValue,
} from '@my-little-garden/core';
import type { DatabaseSync } from 'node:sqlite';

type ScalarRow = {
  id: string;
  name: string;
  height_min_cm: number | null;
  height_max_cm: number | null;
  type_id: number | null;
  type_label: string | null;
  plant_kind: PlantKind | null;
  bloom_start_month: number | null;
  bloom_end_month: number | null;
  minimum_temperature_celsius: number | null;
  foliage_persistence: FoliagePersistence | null;
  spacing_cm: number | null;
  managed_filename: string | null;
  media_type: string | null;
  checksum_sha256: string | null;
  created_at: string;
  updated_at: string;
};

type ValueRow = { plant_id: string; id: number; label: string };
type CodeRow = { plant_id: string; value: string };

function requireNonEmpty<T>(values: T[], field: string, plantId: string): [T, ...T[]] {
  if (values.length === 0) {
    throw new Error(`Plant ${plantId} has no ${field}.`);
  }
  return values as [T, ...T[]];
}

function groupValues(rows: readonly ValueRow[]): Map<string, VocabularyValue[]> {
  const grouped = new Map<string, VocabularyValue[]>();
  for (const row of rows) {
    const values = grouped.get(row.plant_id) ?? [];
    values.push({ id: row.id, label: row.label });
    grouped.set(row.plant_id, values);
  }
  return grouped;
}

function groupCodes<T extends string>(rows: readonly CodeRow[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const values = grouped.get(row.plant_id) ?? [];
    values.push(row.value as T);
    grouped.set(row.plant_id, values);
  }
  return grouped;
}

export class SqlitePlantCatalogRepository implements PlantCatalogRepository {
  constructor(private readonly database: DatabaseSync) {}

  async list(request: PlantPageRequest): Promise<PlantPage> {
    const offset = Math.max(0, Math.trunc(request.offset));
    const limit = Math.max(1, Math.trunc(request.limit));
    const total = Number(
      this.database.prepare('SELECT count(*) AS total FROM plants').get()?.total ?? 0,
    );
    const rows = this.database.prepare(`
      SELECT p.id, p.name, p.height_min_cm, p.height_max_cm,
             p.type_id, pt.label AS type_label, p.plant_kind,
             p.bloom_start_month, p.bloom_end_month,
             p.minimum_temperature_celsius, p.foliage_persistence,
             p.spacing_cm, p.created_at, p.updated_at,
             ph.managed_filename, ph.media_type, ph.checksum_sha256
      FROM plants p
      LEFT JOIN plant_types pt ON pt.id = p.type_id
      LEFT JOIN plant_photos ph ON ph.plant_id = p.id
      ORDER BY p.normalized_name COLLATE NOCASE, p.name COLLATE NOCASE, p.id
      LIMIT ? OFFSET ?
    `).all(limit, offset) as ScalarRow[];

    if (rows.length === 0) return { items: [], total };

    const ids = rows.map(({ id }) => id);
    const placeholders = ids.map(() => '?').join(', ');
    const soils = groupValues(this.database.prepare(`
      SELECT ps.plant_id, st.id, st.label FROM plant_soils ps
      JOIN soil_types st ON st.id = ps.soil_type_id
      WHERE ps.plant_id IN (${placeholders}) ORDER BY st.normalized_label
    `).all(...ids) as ValueRow[]);
    const flowerColors = groupValues(this.database.prepare(`
      SELECT pfc.plant_id, c.id, c.label FROM plant_flower_colors pfc
      JOIN colors c ON c.id = pfc.color_id
      WHERE pfc.plant_id IN (${placeholders}) ORDER BY c.normalized_label
    `).all(...ids) as ValueRow[]);
    const leafColors = groupValues(this.database.prepare(`
      SELECT plc.plant_id, c.id, c.label FROM plant_leaf_colors plc
      JOIN colors c ON c.id = plc.color_id
      WHERE plc.plant_id IN (${placeholders}) ORDER BY c.normalized_label
    `).all(...ids) as ValueRow[]);
    const exposures = groupCodes<ExposureCode>(this.database.prepare(`
      SELECT plant_id, exposure_code AS value FROM plant_exposures
      WHERE plant_id IN (${placeholders})
      ORDER BY CASE exposure_code WHEN 'sun' THEN 1 WHEN 'partial_shade' THEN 2 ELSE 3 END
    `).all(...ids) as CodeRow[]);
    const plantingSeasons = groupCodes<PlantingSeasonCode>(this.database.prepare(`
      SELECT plant_id, season_code AS value FROM plant_planting_seasons
      WHERE plant_id IN (${placeholders})
      ORDER BY CASE season_code WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 WHEN 'autumn' THEN 3 ELSE 4 END
    `).all(...ids) as CodeRow[]);

    const items: Plant[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      heightCm: row.height_min_cm === null
        ? null
        : { min: row.height_min_cm, max: row.height_max_cm },
      type: row.type_id === null || row.type_label === null
        ? null
        : { id: row.type_id, label: row.type_label },
      kind: row.plant_kind,
      soils: requireNonEmpty(soils.get(row.id) ?? [], 'soil', row.id),
      exposures: requireNonEmpty(exposures.get(row.id) ?? [], 'exposure', row.id),
      bloom: row.bloom_start_month === null || row.bloom_end_month === null
        ? null
        : { startMonth: row.bloom_start_month, endMonth: row.bloom_end_month },
      flowerColors: flowerColors.get(row.id) ?? [],
      leafColors: leafColors.get(row.id) ?? [],
      minimumTemperatureCelsius: row.minimum_temperature_celsius,
      foliagePersistence: row.foliage_persistence,
      spacingCm: row.spacing_cm,
      plantingSeasons: plantingSeasons.get(row.id) ?? [],
      photo: row.managed_filename && row.media_type && row.checksum_sha256
        ? {
            managedFilename: row.managed_filename,
            mediaType: row.media_type as NonNullable<Plant['photo']>['mediaType'],
            checksumSha256: row.checksum_sha256,
          }
        : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));

    return { items, total };
  }
}
