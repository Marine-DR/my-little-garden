import { randomUUID } from 'node:crypto';
import {
  normalizeDatabaseKey,
  validatePlantWriteInput,
  type ExposureCode,
  type PlantKind,
  type PlantWriteInput,
  type PlantingSeasonCode,
} from '@my-little-garden/core';
import type { DatabaseSync } from 'node:sqlite';

const MONTHS: Record<string, number> = {
  janvier: 1,
  fevrier: 2,
  mars: 3,
  avril: 4,
  mai: 5,
  juin: 6,
  juillet: 7,
  aout: 8,
  septembre: 9,
  octobre: 10,
  novembre: 11,
  decembre: 12,
};

function optional(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return !trimmed || normalizeDatabaseKey(trimmed) === 'n/a' ? null : trimmed;
}

function integer(value: string | undefined): number | null {
  const text = optional(value);
  if (text === null) {
    return null;
  }
  const parsed = Number(text);
  if (!Number.isInteger(parsed)) {
    throw new Error(`Invalid integer value: ${text}`);
  }
  return parsed;
}

function list(value: string | undefined): string[] {
  const text = optional(value);
  return text === null
    ? []
    : text
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean);
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
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

function exposures(value: string | undefined): ExposureCode[] {
  const codes = new Set<ExposureCode>();
  for (const item of list(value)) {
    const key = normalizeDatabaseKey(item);
    if (key.includes('soleil')) {
      codes.add('sun');
    }
    if (key.includes('mi-ombre') || key.includes('mi ombre')) {
      codes.add('partial_shade');
    }
    if (key === 'ombre') {
      codes.add('shade');
    }
  }
  return [...codes];
}

function seasons(value: string | undefined): PlantingSeasonCode[] {
  const codes = new Set<PlantingSeasonCode>();
  for (const item of list(value)) {
    const key = normalizeDatabaseKey(item);
    if (key.startsWith('printemps')) {
      codes.add('spring');
    } else if (key.startsWith('ete')) {
      codes.add('summer');
    } else if (key.startsWith('automne')) {
      codes.add('autumn');
    } else if (key.startsWith('hiver')) {
      codes.add('winter');
    }
  }
  return [...codes];
}

export function seedDemoCatalog(database: DatabaseSync, csv: string): number {
  const lines = csv
    .replace(/^\uFEFF/u, '')
    .split(/\r?\n/u)
    .filter((line) => line.trim());
  const rows = lines.slice(1).map(parseCsvLine);
  const now = new Date().toISOString();
  let imported = 0;

  database.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      const name = optional(row[0]);
      if (!name) {
        continue;
      }
      const type = optional(row[3]);
      const kindKey = normalizeDatabaseKey(row[4] ?? '');
      const kind: PlantKind | null =
        kindKey === 'fleur'
          ? 'flower'
          : kindKey === 'feuillage'
            ? 'foliage'
            : kindKey === 'graminee'
              ? 'grass'
              : kindKey
                ? 'other'
                : null;
      const bloomStart = MONTHS[normalizeDatabaseKey(row[7] ?? '')] ?? null;
      const bloomEnd = MONTHS[normalizeDatabaseKey(row[8] ?? '')] ?? null;
      const hasCompleteBloom = bloomStart !== null && bloomEnd !== null;
      const bloomStartValue = hasCompleteBloom ? bloomStart : null;
      const bloomEndValue = hasCompleteBloom ? bloomEnd : null;
      const persistenceKey = normalizeDatabaseKey(row[12] ?? '');
      const persistence =
        persistenceKey === 'oui'
          ? 'evergreen'
          : persistenceKey === 'non'
            ? 'deciduous'
            : persistenceKey === 'semi'
              ? 'semi_evergreen'
              : null;
      const id = randomUUID();
      const heightMin = integer(row[1]);
      const heightMax = integer(row[2]);
      if (heightMin === null && heightMax !== null) {
        throw new Error(
          `Plant ${name} has a maximum height without a minimum height.`,
        );
      }
      const soilLabels = list(row[5]);
      const exposureCodes = exposures(row[6]);
      const flowerColorLabels = list(row[9]);
      const leafColorLabels = list(row[10]);
      const plantingSeasons = seasons(row[14]);
      const input: PlantWriteInput = {
        id,
        name,
        heightCm:
          heightMin === null ? null : { min: heightMin, max: heightMax },
        typeLabel: type,
        kind,
        soilLabels,
        exposures: exposureCodes,
        bloom:
          bloomStart !== null && bloomEnd !== null
            ? { startMonth: bloomStart, endMonth: bloomEnd }
            : null,
        flowerColorLabels,
        leafColorLabels,
        minimumTemperatureCelsius: integer(row[11]),
        foliagePersistence: persistence,
        spacingCm: integer(row[13]),
        plantingSeasons,
        photo: null,
      };
      const issues = validatePlantWriteInput(input);
      if (issues.length > 0) {
        const details = issues
          .map(({ field, message }) => `${field}: ${message}`)
          .join('; ');
        throw new Error(`Invalid demo plant ${name}: ${details}`);
      }

      database
        .prepare(
          `INSERT INTO plants (
        id, name, normalized_name, height_min_cm, height_max_cm, type_id, plant_kind,
        bloom_start_month, bloom_end_month, minimum_temperature_celsius,
        foliage_persistence, spacing_cm, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          name,
          normalizeDatabaseKey(name),
          heightMin,
          heightMax,
          type ? vocabularyId(database, 'plant_types', type) : null,
          kind,
          bloomStartValue,
          bloomEndValue,
          input.minimumTemperatureCelsius,
          persistence,
          input.spacingCm,
          now,
          now,
        );

      for (const soil of soilLabels) {
        database
          .prepare(
            'INSERT INTO plant_soils (plant_id, soil_type_id) VALUES (?, ?)',
          )
          .run(id, vocabularyId(database, 'soil_types', soil));
      }
      for (const code of exposureCodes) {
        database
          .prepare(
            'INSERT INTO plant_exposures (plant_id, exposure_code) VALUES (?, ?)',
          )
          .run(id, code);
      }
      for (const color of flowerColorLabels) {
        database
          .prepare(
            'INSERT INTO plant_flower_colors (plant_id, color_id) VALUES (?, ?)',
          )
          .run(id, vocabularyId(database, 'colors', color));
      }
      for (const color of leafColorLabels) {
        database
          .prepare(
            'INSERT INTO plant_leaf_colors (plant_id, color_id) VALUES (?, ?)',
          )
          .run(id, vocabularyId(database, 'colors', color));
      }
      for (const code of plantingSeasons) {
        database
          .prepare(
            'INSERT INTO plant_planting_seasons (plant_id, season_code) VALUES (?, ?)',
          )
          .run(id, code);
      }
      imported += 1;
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return imported;
}
