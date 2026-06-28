import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

const MONTHS: Record<string, number> = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12,
};

function normalize(value: string): string {
  return value.trim().replace(/\s+/gu, ' ').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

function optional(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return !trimmed || normalize(trimmed) === 'n/a' ? null : trimmed;
}

function integer(value: string | undefined): number | null {
  const text = optional(value);
  if (text === null) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function list(value: string | undefined): string[] {
  const text = optional(value);
  return text === null ? [] : text.split('|').map((item) => item.trim()).filter(Boolean);
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
      } else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(value);
      value = '';
    } else value += character;
  }
  values.push(value);
  return values;
}

function vocabularyId(database: DatabaseSync, table: 'plant_types' | 'soil_types' | 'colors', label: string): number {
  const normalized = normalize(label);
  const existing = database.prepare(`SELECT id FROM ${table} WHERE normalized_label = ?`).get(normalized);
  if (existing) return Number(existing.id);
  const result = database.prepare(
    `INSERT INTO ${table} (label, normalized_label, created_at) VALUES (?, ?, ?) RETURNING id`,
  ).get(label, normalized, new Date().toISOString());
  return Number(result?.id);
}

function exposures(value: string | undefined): string[] {
  const codes = new Set<string>();
  for (const item of list(value)) {
    const key = normalize(item);
    if (key.includes('soleil')) codes.add('sun');
    if (key.includes('mi-ombre') || key.includes('mi ombre')) codes.add('partial_shade');
    if (key === 'ombre') codes.add('shade');
  }
  return [...codes];
}

function seasons(value: string | undefined): string[] {
  const codes = new Set<string>();
  for (const item of list(value)) {
    const key = normalize(item);
    if (key.startsWith('printemps')) codes.add('spring');
    else if (key.startsWith('ete')) codes.add('summer');
    else if (key.startsWith('automne')) codes.add('autumn');
    else if (key.startsWith('hiver')) codes.add('winter');
  }
  return [...codes];
}

export function seedDemoCatalog(database: DatabaseSync, csv: string): number {
  const lines = csv.replace(/^\uFEFF/u, '').split(/\r?\n/u).filter((line) => line.trim());
  const rows = lines.slice(1).map(parseCsvLine);
  const now = new Date().toISOString();

  database.exec('BEGIN IMMEDIATE');
  try {
    for (const row of rows) {
      const name = optional(row[0]);
      if (!name) continue;
      const type = optional(row[3]);
      const kindKey = normalize(row[4] ?? '');
      const kind = kindKey === 'fleur' ? 'flower' : kindKey === 'feuillage' ? 'foliage'
        : kindKey === 'graminee' ? 'grass' : kindKey ? 'other' : null;
      const bloomStart = MONTHS[normalize(row[7] ?? '')] ?? null;
      const bloomEnd = MONTHS[normalize(row[8] ?? '')] ?? null;
      const hasCompleteBloom = bloomStart !== null && bloomEnd !== null;
      const bloomStartValue = hasCompleteBloom ? bloomStart : null;
      const bloomEndValue = hasCompleteBloom ? bloomEnd : null;
      const persistenceKey = normalize(row[12] ?? '');
      const persistence = persistenceKey === 'oui' ? 'evergreen' : persistenceKey === 'non' ? 'deciduous'
        : persistenceKey === 'semi' ? 'semi_evergreen' : null;
      const id = randomUUID();

      database.prepare(`INSERT INTO plants (
        id, name, normalized_name, height_min_cm, height_max_cm, type_id, plant_kind,
        bloom_start_month, bloom_end_month, minimum_temperature_celsius,
        foliage_persistence, spacing_cm, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, name, normalize(name), integer(row[1]), integer(row[2]),
          type ? vocabularyId(database, 'plant_types', type) : null, kind,
          bloomStartValue, bloomEndValue, integer(row[11]), persistence, integer(row[13]), now, now);

      for (const soil of list(row[5])) {
        database.prepare('INSERT INTO plant_soils (plant_id, soil_type_id) VALUES (?, ?)')
          .run(id, vocabularyId(database, 'soil_types', soil));
      }
      for (const code of exposures(row[6])) {
        database.prepare('INSERT INTO plant_exposures (plant_id, exposure_code) VALUES (?, ?)').run(id, code);
      }
      for (const color of list(row[9])) {
        database.prepare('INSERT INTO plant_flower_colors (plant_id, color_id) VALUES (?, ?)')
          .run(id, vocabularyId(database, 'colors', color));
      }
      for (const color of list(row[10])) {
        database.prepare('INSERT INTO plant_leaf_colors (plant_id, color_id) VALUES (?, ?)')
          .run(id, vocabularyId(database, 'colors', color));
      }
      for (const code of seasons(row[14])) {
        database.prepare('INSERT INTO plant_planting_seasons (plant_id, season_code) VALUES (?, ?)').run(id, code);
      }
    }
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  }
  return rows.length;
}
