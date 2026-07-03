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
  if (quoted) throw new Error('Guillemet non fermé dans le fichier CSV.');
  values.push(value);
  return values;
}

export const CATALOG_CSV_HEADERS = [
  'Nom',
  'Taille min',
  'Taille Max',
  'Type',
  'Fleur/autre',
  'Sol',
  'Exposition',
  'Floraison début',
  'Floraison Fin',
  'Couleurs fleurs',
  'Couleurs feuilles',
  'T° min (°C)',
  'Feuillage persistant',
  'Espace(cm)',
  'Plantation',
] as const;

const TOO_MANY_COLUMNS_MESSAGE =
  "Il y a plus de colonne qu'attendu dans le fichier. Si vous avez plusieurs éléments dans une cellule, merci d'utiliser | pour les séparer";

function headerErrors(header: readonly string[]): string[] {
  const actual = header.map((value) => value.trim());
  const normalizedActual = actual.map((value) => value.toLocaleLowerCase('fr'));
  const errors: string[] = [];
  for (const expected of CATALOG_CSV_HEADERS) {
    if (!normalizedActual.includes(expected.toLocaleLowerCase('fr'))) {
      errors.push(
        `La colonnes ${expected} n'est pas présente dans le fichier d'entrée`,
      );
    }
  }
  for (const value of actual) {
    if (
      value &&
      !(CATALOG_CSV_HEADERS as readonly string[]).some(
        (expected) =>
          expected.toLocaleLowerCase('fr') === value.toLocaleLowerCase('fr'),
      )
    ) {
      errors.push(
        `La colonne ${value} présente dans le fichier n'a pas le bon nom ou ne fait pas parti des éléments supportés`,
      );
    }
  }
  if (header.length > CATALOG_CSV_HEADERS.length) {
    errors.push(TOO_MANY_COLUMNS_MESSAGE);
  }
  return errors;
}

interface ParsedCatalogCsv {
  readonly rows: readonly string[][];
  readonly errors: readonly string[];
}

function parseCatalogCsv(csv: string): ParsedCatalogCsv {
  const lines = csv
    .replace(/^\uFEFF/u, '')
    .split(/\r?\n/u)
    .filter((line) => line.trim());
  if (lines.length === 0) return { rows: [], errors: ['Le fichier est vide'] };
  const errors = headerErrors(parseCsvLine(lines[0]!));
  if (lines.length === 1) errors.unshift('Le fichier est vide');
  const rows = lines.slice(1).map((line) => {
    const row = parseCsvLine(line);
    if (
      row.length > CATALOG_CSV_HEADERS.length &&
      !errors.includes(TOO_MANY_COLUMNS_MESSAGE)
    ) {
      errors.push(TOO_MANY_COLUMNS_MESSAGE);
    } else if (row.length < CATALOG_CSV_HEADERS.length) {
      for (const missing of CATALOG_CSV_HEADERS.slice(row.length)) {
        const message = `La colonnes ${missing} n'est pas présente dans le fichier d'entrée`;
        if (!errors.includes(message)) errors.push(message);
      }
    }
    return row;
  });
  return { rows, errors };
}

export function validateCatalogCsvStructure(csv: string): readonly string[] {
  try {
    return parseCatalogCsv(csv).errors;
  } catch (error) {
    return [
      error instanceof Error ? error.message : 'Le fichier CSV est invalide.',
    ];
  }
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
    let recognized = false;
    if (key.includes('soleil')) {
      codes.add('sun');
      recognized = true;
    }
    if (key.includes('mi-ombre') || key.includes('mi ombre')) {
      codes.add('partial_shade');
      recognized = true;
    }
    if (key === 'ombre') {
      codes.add('shade');
      recognized = true;
    }
    if (!recognized) throw new Error(`Exposition inconnue : ${item}`);
  }
  return [...codes];
}

function seasons(value: string | undefined): PlantingSeasonCode[] {
  const codes = new Set<PlantingSeasonCode>();
  for (const item of list(value)) {
    const key = normalizeDatabaseKey(item);
    if (key.startsWith('printemps')) codes.add('spring');
    else if (key.startsWith('ete')) codes.add('summer');
    else if (key.startsWith('automne')) codes.add('autumn');
    else if (key.startsWith('hiver')) codes.add('winter');
    else throw new Error(`Saison de plantation inconnue : ${item}`);
  }
  return [...codes];
}

export function replaceCatalogFromCsv(
  database: DatabaseSync,
  csv: string,
): number {
  const { rows, errors } = parseCatalogCsv(csv);
  if (errors.length > 0) throw new Error(errors.join('\n'));
  const now = new Date().toISOString();
  let imported = 0;

  database.exec('BEGIN IMMEDIATE');
  try {
    database.exec('DELETE FROM plants');
    for (const [rowIndex, row] of rows.entries()) {
      const name = optional(row[0]);
      if (!name)
        throw new Error(`Ligne ${rowIndex + 2} : le nom est obligatoire.`);
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
      const bloomStartText = optional(row[7]);
      const bloomEndText = optional(row[8]);
      const bloomStart = bloomStartText
        ? (MONTHS[normalizeDatabaseKey(bloomStartText)] ?? null)
        : null;
      const bloomEnd = bloomEndText
        ? (MONTHS[normalizeDatabaseKey(bloomEndText)] ?? null)
        : null;
      if (
        (bloomStartText && bloomStart === null) ||
        (bloomEndText && bloomEnd === null)
      ) {
        throw new Error(`Ligne ${rowIndex + 2} : mois de floraison inconnu.`);
      }
      if ((bloomStart === null) !== (bloomEnd === null)) {
        throw new Error(
          `Ligne ${rowIndex + 2} : les deux mois de floraison sont requis ensemble.`,
        );
      }
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
      if (optional(row[12]) && persistence === null) {
        throw new Error(
          `Ligne ${rowIndex + 2} : valeur de feuillage persistant inconnue.`,
        );
      }
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
        throw new Error(`Ligne ${rowIndex + 2} (${name}) : ${details}`);
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

export function seedDemoCatalog(database: DatabaseSync, csv: string): number {
  return replaceCatalogFromCsv(database, csv);
}
