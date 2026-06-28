import { basename } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { CatalogPage, CatalogPlant } from '../shared/catalog.js';

export const CATALOG_PAGE_SIZE = 25;

type ScalarRow = {
  id: string;
  name: string;
  height_min_cm: number | null;
  height_max_cm: number | null;
  type_label: string | null;
  plant_kind: CatalogPlant['kind'];
  bloom_start_month: number | null;
  bloom_end_month: number | null;
  minimum_temperature_celsius: number | null;
  foliage_persistence: CatalogPlant['foliagePersistence'];
  spacing_cm: number | null;
  managed_filename: string | null;
};

type RelationName = 'soils' | 'exposures' | 'flowerColors' | 'leafColors' | 'plantingSeasons';
type RelationMap = Record<RelationName, Map<string, string[]>>;

function readRelations(database: DatabaseSync, ids: readonly string[]): RelationMap {
  const relations: RelationMap = {
    soils: new Map(),
    exposures: new Map(),
    flowerColors: new Map(),
    leafColors: new Map(),
    plantingSeasons: new Map(),
  };

  if (ids.length === 0) return relations;

  const placeholders = ids.map(() => '?').join(', ');
  const queries: ReadonlyArray<{ name: RelationName; sql: string }> = [
    {
      name: 'soils',
      sql: `SELECT ps.plant_id, st.label AS value FROM plant_soils ps
            JOIN soil_types st ON st.id = ps.soil_type_id
            WHERE ps.plant_id IN (${placeholders}) ORDER BY st.normalized_label`,
    },
    {
      name: 'exposures',
      sql: `SELECT plant_id, exposure_code AS value FROM plant_exposures
            WHERE plant_id IN (${placeholders})
            ORDER BY CASE exposure_code WHEN 'sun' THEN 1 WHEN 'partial_shade' THEN 2 ELSE 3 END`,
    },
    {
      name: 'flowerColors',
      sql: `SELECT pfc.plant_id, c.label AS value FROM plant_flower_colors pfc
            JOIN colors c ON c.id = pfc.color_id
            WHERE pfc.plant_id IN (${placeholders}) ORDER BY c.normalized_label`,
    },
    {
      name: 'leafColors',
      sql: `SELECT plc.plant_id, c.label AS value FROM plant_leaf_colors plc
            JOIN colors c ON c.id = plc.color_id
            WHERE plc.plant_id IN (${placeholders}) ORDER BY c.normalized_label`,
    },
    {
      name: 'plantingSeasons',
      sql: `SELECT plant_id, season_code AS value FROM plant_planting_seasons
            WHERE plant_id IN (${placeholders})
            ORDER BY CASE season_code WHEN 'spring' THEN 1 WHEN 'summer' THEN 2 WHEN 'autumn' THEN 3 ELSE 4 END`,
    },
  ];

  for (const query of queries) {
    const rows = database.prepare(query.sql).all(...ids) as Array<{ plant_id: string; value: string }>;
    for (const row of rows) {
      const values = relations[query.name].get(row.plant_id) ?? [];
      values.push(row.value);
      relations[query.name].set(row.plant_id, values);
    }
  }

  return relations;
}

function photoUrl(filename: string | null): string | null {
  if (!filename || basename(filename) !== filename) return null;
  return `garden-photo:///${encodeURIComponent(filename)}`;
}

export function listCatalogPlants(database: DatabaseSync, requestedPage: number): CatalogPage {
  const total = Number(database.prepare('SELECT count(*) AS total FROM plants').get()?.total ?? 0);
  const pageCount = Math.max(1, Math.ceil(total / CATALOG_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(requestedPage) || 1), pageCount);
  const offset = (page - 1) * CATALOG_PAGE_SIZE;
  const rows = database.prepare(`
    SELECT p.id, p.name, p.height_min_cm, p.height_max_cm,
           pt.label AS type_label, p.plant_kind, p.bloom_start_month,
           p.bloom_end_month, p.minimum_temperature_celsius,
           p.foliage_persistence, p.spacing_cm, ph.managed_filename
    FROM plants p
    LEFT JOIN plant_types pt ON pt.id = p.type_id
    LEFT JOIN plant_photos ph ON ph.plant_id = p.id
    ORDER BY p.normalized_name COLLATE NOCASE, p.name COLLATE NOCASE, p.id
    LIMIT ? OFFSET ?
  `).all(CATALOG_PAGE_SIZE, offset) as ScalarRow[];
  const relations = readRelations(database, rows.map((row) => row.id));

  const items: CatalogPlant[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    photoUrl: photoUrl(row.managed_filename),
    heightMinCm: row.height_min_cm,
    heightMaxCm: row.height_max_cm,
    type: row.type_label,
    kind: row.plant_kind,
    soils: relations.soils.get(row.id) ?? [],
    exposures: (relations.exposures.get(row.id) ?? []) as CatalogPlant['exposures'],
    bloomStartMonth: row.bloom_start_month,
    bloomEndMonth: row.bloom_end_month,
    flowerColors: relations.flowerColors.get(row.id) ?? [],
    leafColors: relations.leafColors.get(row.id) ?? [],
    minimumTemperatureCelsius: row.minimum_temperature_celsius,
    foliagePersistence: row.foliage_persistence,
    spacingCm: row.spacing_cm,
    plantingSeasons: (relations.plantingSeasons.get(row.id) ?? []) as CatalogPlant['plantingSeasons'],
  }));

  return { items, page, pageSize: CATALOG_PAGE_SIZE, total };
}
