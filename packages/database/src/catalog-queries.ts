import type {
  ExposureCode,
  FoliagePersistence,
  PlantCatalogFilterOptions,
  PlantCatalogFilters,
} from '@my-little-garden/core';
import {
  EXPOSURE_CODES,
  activeBloomMonths,
  sanitizeCatalogFilters,
} from '@my-little-garden/core';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import {
  TypedQuery,
  nullableNumberColumn,
  nullableStringColumn,
  numberColumn,
  stringColumn,
  type SqliteRow,
} from './typed-query';
import { inClausePlaceholders } from './query-builders';

export type CatalogScalarRow = {
  id: string;
  name: string;
  heightMinCm: number | null;
  heightMaxCm: number | null;
  typeId: number | null;
  typeLabel: string | null;
  bloomStartMonth: number | null;
  bloomEndMonth: number | null;
  minimumTemperatureCelsius: number | null;
  foliagePersistence: FoliagePersistence | null;
  spacingCm: number | null;
  managedFilename: string | null;
  mediaType: string | null;
  checksumSha256: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CatalogValueRow = {
  plantId: string;
  id: number;
  label: string;
};

export type CatalogCodeRow = {
  plantId: string;
  value: string;
};

function decodeScalar(row: SqliteRow): CatalogScalarRow {
  return {
    id: stringColumn(row, 'id'),
    name: stringColumn(row, 'name'),
    heightMinCm: nullableNumberColumn(row, 'height_min_cm'),
    heightMaxCm: nullableNumberColumn(row, 'height_max_cm'),
    typeId: nullableNumberColumn(row, 'type_id'),
    typeLabel: nullableStringColumn(row, 'type_label'),
    bloomStartMonth: nullableNumberColumn(row, 'bloom_start_month'),
    bloomEndMonth: nullableNumberColumn(row, 'bloom_end_month'),
    minimumTemperatureCelsius: nullableNumberColumn(
      row,
      'minimum_temperature_celsius',
    ),
    foliagePersistence: nullableStringColumn(
      row,
      'foliage_persistence',
    ) as FoliagePersistence | null,
    spacingCm: nullableNumberColumn(row, 'spacing_cm'),
    managedFilename: nullableStringColumn(row, 'managed_filename'),
    mediaType: nullableStringColumn(row, 'media_type'),
    checksumSha256: nullableStringColumn(row, 'checksum_sha256'),
    createdAt: stringColumn(row, 'created_at'),
    updatedAt: stringColumn(row, 'updated_at'),
  };
}

function decodeValue(row: SqliteRow): CatalogValueRow {
  return {
    plantId: stringColumn(row, 'plant_id'),
    id: numberColumn(row, 'id'),
    label: stringColumn(row, 'label'),
  };
}

function decodeCode(row: SqliteRow): CatalogCodeRow {
  return {
    plantId: stringColumn(row, 'plant_id'),
    value: stringColumn(row, 'value'),
  };
}

type RelationQueries = {
  kinds: TypedQuery<SQLInputValue[], CatalogValueRow>;
  soils: TypedQuery<SQLInputValue[], CatalogValueRow>;
  flowerColors: TypedQuery<SQLInputValue[], CatalogValueRow>;
  leafColors: TypedQuery<SQLInputValue[], CatalogValueRow>;
  exposures: TypedQuery<SQLInputValue[], CatalogCodeRow>;
  plantingSeasons: TypedQuery<SQLInputValue[], CatalogCodeRow>;
};

const catalogScalarProjection = `p.id, p.name, p.height_min_cm, p.height_max_cm,
  p.type_id, pt.label AS type_label,
  p.bloom_start_month, p.bloom_end_month,
  p.minimum_temperature_celsius, p.foliage_persistence,
  p.spacing_cm, p.created_at, p.updated_at,
  ph.managed_filename, ph.media_type, ph.checksum_sha256`;
const catalogScalarSources = `FROM plants p
  LEFT JOIN referential_plant_types pt ON pt.id = p.type_id
  LEFT JOIN plant_photos ph ON ph.plant_id = p.id`;
const catalogScalarOrder = `ORDER BY p.normalized_name COLLATE NOCASE,
  p.name COLLATE NOCASE, p.id`;

type CatalogScalarQueryOptions = {
  distinct?: boolean;
  joins?: string;
  where?: string;
};

function selectCatalogScalars(options?: CatalogScalarQueryOptions): string {
  return `SELECT ${options?.distinct ? 'DISTINCT ' : ''}${catalogScalarProjection}
    ${catalogScalarSources}
    ${options?.joins ?? ''}
    ${options?.where ?? ''}
    ${catalogScalarOrder}`;
}

function selectPaginatedCatalogScalars(
  options?: CatalogScalarQueryOptions,
): string {
  return `${selectCatalogScalars(options)}
    LIMIT ? OFFSET ?`;
}

function filteredCatalogParts(filters: PlantCatalogFilters | undefined): {
  joins: string;
  clause: string;
  parameters: SQLInputValue[];
} {
  const activeFilters = sanitizeCatalogFilters(filters);
  const joins: string[] = [];
  const clauses: string[] = [];
  const parameters: SQLInputValue[] = [];
  const {
    soils,
    exposures,
    bloomMonths,
    plantKinds,
    flowerColors,
    leafColors,
  } = activeFilters;

  if (soils.length > 0) {
    joins.push(`JOIN plant_soils ps_filter ON ps_filter.plant_id = p.id`);
    joins.push(
      `JOIN referential_soil_types st_filter ON st_filter.id = ps_filter.soil_type_id`,
    );
    clauses.push(`st_filter.label IN (${inClausePlaceholders(soils.length)})`);
    parameters.push(...soils);
  }

  if (exposures.length > 0) {
    joins.push(`JOIN plant_exposures pe_filter ON pe_filter.plant_id = p.id`);
    clauses.push(
      `pe_filter.exposure_code IN (${inClausePlaceholders(exposures.length)})`,
    );
    parameters.push(...exposures);
  }

  if (bloomMonths.length > 0) {
    clauses.push(`p.bloom_start_month IS NOT NULL
      AND p.bloom_end_month IS NOT NULL
      AND (${bloomMonths
        .map(
          () => `((
            p.bloom_start_month <= p.bloom_end_month
            AND ? BETWEEN p.bloom_start_month AND p.bloom_end_month
          ) OR (
            p.bloom_start_month > p.bloom_end_month
            AND (? >= p.bloom_start_month OR ? <= p.bloom_end_month)
          ))`,
        )
        .join(' OR ')})`);
    for (const month of bloomMonths) {
      parameters.push(month, month, month);
    }
  }

  if (plantKinds.length > 0) {
    joins.push(
      `JOIN plant_kind_assignments pka_filter ON pka_filter.plant_id = p.id`,
    );
    joins.push(
      `JOIN referential_plant_kinds pk_filter ON pk_filter.id = pka_filter.plant_kind_id`,
    );
    clauses.push(
      `pk_filter.label IN (${inClausePlaceholders(plantKinds.length)})`,
    );
    parameters.push(...plantKinds);
  }

  if (flowerColors.length > 0) {
    joins.push(
      `JOIN plant_flower_colors pfc_filter ON pfc_filter.plant_id = p.id`,
    );
    joins.push(
      `JOIN referential_colors fc_filter ON fc_filter.id = pfc_filter.color_id`,
    );
    clauses.push(
      `fc_filter.label IN (${inClausePlaceholders(flowerColors.length)})`,
    );
    parameters.push(...flowerColors);
  }

  if (leafColors.length > 0) {
    joins.push(
      `JOIN plant_leaf_colors plc_filter ON plc_filter.plant_id = p.id`,
    );
    joins.push(
      `JOIN referential_colors lc_filter ON lc_filter.id = plc_filter.color_id`,
    );
    clauses.push(
      `lc_filter.label IN (${inClausePlaceholders(leafColors.length)})`,
    );
    parameters.push(...leafColors);
  }

  return {
    joins: joins.join('\n'),
    clause: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '',
    parameters,
  };
}

export class CatalogQueries {
  private readonly count: TypedQuery<[], { total: number }>;
  private readonly plants: TypedQuery<[number, number], CatalogScalarRow>;
  private readonly relationsByPageSize = new Map<number, RelationQueries>();

  constructor(private readonly database: DatabaseSync) {
    this.count = new TypedQuery(
      database,
      'SELECT count(*) AS total FROM plants',
      (row) => ({ total: numberColumn(row, 'total') }),
    );
    this.plants = new TypedQuery(
      database,
      selectPaginatedCatalogScalars(),
      decodeScalar,
    );
  }

  total(filters?: PlantCatalogFilters): number {
    const { joins, clause, parameters } = filteredCatalogParts(filters);
    if (!clause) {
      return this.count.get()?.total ?? 0;
    }
    const row = this.database
      .prepare(
        `SELECT count(DISTINCT p.id) AS total FROM plants p
        ${joins}
        ${clause}`,
      )
      .get(...parameters) as SqliteRow | undefined;
    return row ? numberColumn(row, 'total') : 0;
  }

  ids(filters?: PlantCatalogFilters): string[] {
    const { joins, clause, parameters } = filteredCatalogParts(filters);
    return this.database
      .prepare(
        `SELECT DISTINCT p.id, p.normalized_name
         FROM plants p
         ${joins}
         ${clause}
         ORDER BY p.normalized_name COLLATE NOCASE`,
      )
      .all(...parameters)
      .map((row) => stringColumn(row as SqliteRow, 'id'));
  }

  page(
    limit: number,
    offset: number,
    filters?: PlantCatalogFilters,
  ): CatalogScalarRow[] {
    const { joins, clause, parameters } = filteredCatalogParts(filters);
    if (!clause) {
      return this.plants.all(limit, offset);
    }
    return this.database
      .prepare(
        selectPaginatedCatalogScalars({
          distinct: true,
          joins,
          where: clause,
        }),
      )
      .all(...parameters, limit, offset)
      .map((row) => decodeScalar(row as SqliteRow));
  }

  byIds(ids: readonly string[]): CatalogScalarRow[] {
    if (ids.length === 0) {
      return [];
    }
    const placeholders = inClausePlaceholders(ids.length);
    return this.database
      .prepare(
        selectCatalogScalars({ where: `WHERE p.id IN (${placeholders})` }),
      )
      .all(...ids)
      .map((row) => decodeScalar(row as SqliteRow));
  }

  byNormalizedName(normalizedName: string): CatalogScalarRow[] {
    return this.database
      .prepare(selectCatalogScalars({ where: 'WHERE p.normalized_name = ?' }))
      .all(normalizedName)
      .map((row) => decodeScalar(row as SqliteRow));
  }

  filterOptions(): PlantCatalogFilterOptions {
    const soils = this.database
      .prepare(
        `SELECT DISTINCT st.label, st.normalized_label FROM referential_soil_types st
         JOIN plant_soils ps ON ps.soil_type_id = st.id
         ORDER BY st.normalized_label`,
      )
      .all()
      .map((row) => stringColumn(row as SqliteRow, 'label'));
    const exposures = this.database
      .prepare(
        `SELECT DISTINCT exposure_code FROM plant_exposures
         ORDER BY CASE exposure_code
           WHEN 'sun' THEN 1 WHEN 'partial_shade' THEN 2 ELSE 3 END`,
      )
      .all()
      .map((row) => stringColumn(row as SqliteRow, 'exposure_code'))
      .filter((value): value is ExposureCode =>
        EXPOSURE_CODES.includes(value as ExposureCode),
      );
    const bloomMonths = [
      ...new Set(
        this.database
          .prepare(
            `SELECT bloom_start_month, bloom_end_month FROM plants
             WHERE bloom_start_month IS NOT NULL
               AND bloom_end_month IS NOT NULL
             ORDER BY bloom_start_month, bloom_end_month`,
          )
          .all()
          .flatMap((row) =>
            activeBloomMonths(
              numberColumn(row as SqliteRow, 'bloom_start_month'),
              numberColumn(row as SqliteRow, 'bloom_end_month'),
            ),
          ),
      ),
    ];
    const flowerColors = this.database
      .prepare(
        `SELECT DISTINCT c.label, c.normalized_label FROM referential_colors c
         JOIN plant_flower_colors pfc ON pfc.color_id = c.id
         ORDER BY c.normalized_label`,
      )
      .all()
      .map((row) => stringColumn(row as SqliteRow, 'label'));
    const leafColors = this.database
      .prepare(
        `SELECT DISTINCT c.label, c.normalized_label FROM referential_colors c
         JOIN plant_leaf_colors plc ON plc.color_id = c.id
         ORDER BY c.normalized_label`,
      )
      .all()
      .map((row) => stringColumn(row as SqliteRow, 'label'));
    const plantKinds = this.database
      .prepare(
        `SELECT DISTINCT pk.label, pk.normalized_label FROM referential_plant_kinds pk
         JOIN plant_kind_assignments pka ON pka.plant_kind_id = pk.id
         ORDER BY pk.normalized_label`,
      )
      .all()
      .map((row) => stringColumn(row as SqliteRow, 'label'));
    return {
      soils,
      exposures,
      bloomMonths,
      plantKinds,
      flowerColors,
      leafColors,
    };
  }

  relations(ids: readonly string[]): RelationQueries {
    const existing = this.relationsByPageSize.get(ids.length);
    if (existing) {
      return existing;
    }
    const placeholders = inClausePlaceholders(ids.length);
    const queries: RelationQueries = {
      kinds: new TypedQuery(
        this.database,
        `SELECT pka.plant_id, pk.id, pk.label FROM plant_kind_assignments pka
         JOIN referential_plant_kinds pk ON pk.id = pka.plant_kind_id
         WHERE pka.plant_id IN (${placeholders}) ORDER BY pk.normalized_label`,
        decodeValue,
      ),
      soils: new TypedQuery(
        this.database,
        `SELECT ps.plant_id, st.id, st.label FROM plant_soils ps
         JOIN referential_soil_types st ON st.id = ps.soil_type_id
         WHERE ps.plant_id IN (${placeholders}) ORDER BY st.normalized_label`,
        decodeValue,
      ),
      flowerColors: new TypedQuery(
        this.database,
        `SELECT pfc.plant_id, c.id, c.label FROM plant_flower_colors pfc
         JOIN referential_colors c ON c.id = pfc.color_id
         WHERE pfc.plant_id IN (${placeholders}) ORDER BY c.normalized_label`,
        decodeValue,
      ),
      leafColors: new TypedQuery(
        this.database,
        `SELECT plc.plant_id, c.id, c.label FROM plant_leaf_colors plc
         JOIN referential_colors c ON c.id = plc.color_id
         WHERE plc.plant_id IN (${placeholders}) ORDER BY c.normalized_label`,
        decodeValue,
      ),
      exposures: new TypedQuery(
        this.database,
        `SELECT plant_id, exposure_code AS value FROM plant_exposures
         WHERE plant_id IN (${placeholders})
         ORDER BY CASE exposure_code
           WHEN 'sun' THEN 1 WHEN 'partial_shade' THEN 2 ELSE 3 END`,
        decodeCode,
      ),
      plantingSeasons: new TypedQuery(
        this.database,
        `SELECT plant_id, season_code AS value FROM plant_planting_seasons
         WHERE plant_id IN (${placeholders})
         ORDER BY CASE season_code
           WHEN 'spring' THEN 1 WHEN 'summer' THEN 2
           WHEN 'autumn' THEN 3 ELSE 4 END`,
        decodeCode,
      ),
    };
    this.relationsByPageSize.set(ids.length, queries);
    return queries;
  }
}
