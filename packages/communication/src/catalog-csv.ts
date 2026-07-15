import { randomUUID } from 'node:crypto';
import {
  normalizeDatabaseKey,
  validatePlantWriteInput,
  type DataImportError,
  type DataImportResult,
  type ExposureCode,
  type Plant,
  type PlantCatalogExporter,
  type PlantCatalogImporter,
  type PlantKind,
  type PlantWriteInput,
  type PlantingSeasonCode,
} from '@my-little-garden/core';
import { readCsvRows } from './csv-reader';

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

const MONTH_LABELS: Record<number, string> = {
  1: 'Janvier',
  2: 'Fevrier',
  3: 'Mars',
  4: 'Avril',
  5: 'Mai',
  6: 'Juin',
  7: 'Juillet',
  8: 'Aout',
  9: 'Septembre',
  10: 'Octobre',
  11: 'Novembre',
  12: 'Decembre',
};

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

const EXPOSURE_ERROR =
  'La colonne Exposition contient une valeur non reconnue pour au moins une plante. Cette colonne accepte uniquement les valeurs : Soleil, Mi-ombre, Ombre.';
const FOLIAGE_PERSISTENCE_ERROR =
  'La colonne Feuillage persistant contient une valeur non reconnue pour au moins une plante. Cette colonne accepte uniquement les valeurs : oui, semi, non.';
const PLANTING_SEASON_ERROR =
  'La colonne Plantation contient une valeur non reconnue pour au moins une plante. Cette colonne accepte uniquement les valeurs : Printemps, Été, Automne et Hiver.';

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

function isNonNegativeInteger(value: string): boolean {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0;
}

function isIntegerText(value: string): boolean {
  return Number.isInteger(Number(value));
}

function heightCm(
  min: number | null,
  max: number | null,
): PlantWriteInput['heightCm'] {
  return min === null && max === null ? null : { min, max };
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

function issue(code: string, message: string, field?: string): DataImportError {
  return field ? { code, message, field } : { code, message };
}

function numericIssue(parameter: string): DataImportError {
  return issue(
    'invalid_number',
    `Le paramètre ${parameter} n'accepte que des chiffres. Ce paramètre contient autre chose que des chiffres pour une ou plusieurs plantes.`,
    parameter,
  );
}

function containsUnsupportedValue(
  value: string | undefined,
  supported: ReadonlySet<string>,
): boolean {
  const cell = value?.trim() ?? '';
  if (!cell) {
    return false;
  }
  return cell
    .split('|')
    .map((item) => item.trim())
    .some((item) => !item || !supported.has(normalizeDatabaseKey(item)));
}

function addUnique(
  errors: DataImportError[],
  candidate: DataImportError,
): void {
  if (
    !errors.some(
      ({ code, field, message }) =>
        code === candidate.code &&
        field === candidate.field &&
        message === candidate.message,
    )
  ) {
    errors.push(candidate);
  }
}

function headerErrors(header: readonly string[]): DataImportError[] {
  const actual = header.map((value) => value.trim());
  const normalizedActual = actual.map((value) => value.toLocaleLowerCase('fr'));
  const errors: DataImportError[] = [];
  for (const expected of CATALOG_CSV_HEADERS) {
    if (!normalizedActual.includes(expected.toLocaleLowerCase('fr'))) {
      errors.push(
        issue(
          'missing_column',
          `La colonne ${expected} n'est pas présente dans le fichier d'entrée`,
          expected,
        ),
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
        issue(
          'unsupported_column',
          `La colonne ${value} présente dans le fichier n'a pas le bon nom ou ne fait pas partie des éléments supportés`,
          value,
        ),
      );
    }
  }
  if (header.length > CATALOG_CSV_HEADERS.length) {
    errors.push(issue('too_many_columns', TOO_MANY_COLUMNS_MESSAGE));
  }
  return errors;
}

export function validateCatalogCsvStructure(
  csv: string,
): readonly DataImportError[] {
  try {
    const iterator = readCsvRows(csv);
    const header = iterator.next();
    if (header.done) {
      return [issue('empty_file', 'Le fichier est vide')];
    }
    const errors = headerErrors(header.value.values);
    let rowCount = 0;
    for (const { values: row } of iterator) {
      rowCount += 1;
      const rowHasExpectedShape = row.length === CATALOG_CSV_HEADERS.length;
      if (
        row.length > CATALOG_CSV_HEADERS.length &&
        !errors.some(({ code }) => code === 'too_many_columns')
      ) {
        errors.push(issue('too_many_columns', TOO_MANY_COLUMNS_MESSAGE));
      } else if (row.length < CATALOG_CSV_HEADERS.length) {
        for (const missing of CATALOG_CSV_HEADERS.slice(row.length)) {
          addUnique(
            errors,
            issue(
              'missing_column',
              `La colonne ${missing} n'est pas présente dans le fichier d'entrée`,
              missing,
            ),
          );
        }
      }
      if (errors.some(({ code }) => code.includes('column'))) {
        continue;
      }
      if (!rowHasExpectedShape) {
        continue;
      }
      const numericColumns = [
        ['Taille min', 1, false],
        ['Taille Max', 2, false],
        ['T° min (°C)', 11, true],
        ['Espace(cm)', 13, false],
      ] as const;
      for (const [parameter, index, acceptsNegative] of numericColumns) {
        const value = row[index]?.trim() ?? '';
        const isHeightColumn = index === 1 || index === 2;
        const isMissingHeight = isHeightColumn && optional(value) === null;
        const isValidNumber = acceptsNegative
          ? isIntegerText(value)
          : isNonNegativeInteger(value);
        if (value && !isMissingHeight && !isValidNumber) {
          addUnique(errors, numericIssue(parameter));
        }
      }
      if (
        containsUnsupportedValue(
          row[6],
          new Set(['soleil', 'mi-ombre', 'ombre']),
        )
      ) {
        addUnique(
          errors,
          issue('unsupported_value', EXPOSURE_ERROR, 'Exposition'),
        );
      }
      if (containsUnsupportedValue(row[12], new Set(['oui', 'semi', 'non']))) {
        addUnique(
          errors,
          issue(
            'unsupported_value',
            FOLIAGE_PERSISTENCE_ERROR,
            'Feuillage persistant',
          ),
        );
      }
      if (
        containsUnsupportedValue(
          row[14],
          new Set(['printemps', 'ete', 'automne', 'hiver']),
        )
      ) {
        addUnique(
          errors,
          issue('unsupported_value', PLANTING_SEASON_ERROR, 'Plantation'),
        );
      }
    }
    if (rowCount === 0) {
      errors.unshift(issue('empty_file', 'Le fichier est vide'));
    }
    return errors;
  } catch (error) {
    return [
      issue(
        'invalid_csv',
        error instanceof Error ? error.message : 'Le fichier CSV est invalide.',
      ),
    ];
  }
}

function exposures(value: string | undefined): ExposureCode[] {
  const codes = new Set<ExposureCode>();
  for (const item of list(value)) {
    const key = normalizeDatabaseKey(item);
    switch (key) {
      case 'soleil':
        codes.add('sun');
        break;
      case 'mi-ombre':
        codes.add('partial_shade');
        break;
      case 'ombre':
        codes.add('shade');
        break;
      default:
        throw new Error(`Exposition inconnue : ${item}`);
    }
  }
  return [...codes];
}

function seasons(value: string | undefined): PlantingSeasonCode[] {
  const codes = new Set<PlantingSeasonCode>();
  for (const item of list(value)) {
    const key = normalizeDatabaseKey(item);
    switch (key) {
      case 'printemps':
        codes.add('spring');
        break;
      case 'ete':
        codes.add('summer');
        break;
      case 'automne':
        codes.add('autumn');
        break;
      case 'hiver':
        codes.add('winter');
        break;
      default:
        throw new Error(`Saison de plantation inconnue : ${item}`);
    }
  }
  return [...codes];
}

function* plantInputs(csv: string): Generator<PlantWriteInput> {
  const rows = readCsvRows(csv);
  rows.next();
  for (const { values: row, lineNumber } of rows) {
    const rowIndex = lineNumber - 2;
    const name = optional(row[0]);
    if (!name) {
      throw new Error(`Ligne ${rowIndex + 2} : le nom est obligatoire.`);
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
    const input: PlantWriteInput = {
      id,
      name,
      heightCm: heightCm(heightMin, heightMax),
      typeLabel: type,
      kind,
      soilLabels: list(row[5]),
      exposures: exposures(row[6]),
      bloom:
        bloomStart !== null && bloomEnd !== null
          ? { startMonth: bloomStart, endMonth: bloomEnd }
          : null,
      flowerColorLabels: list(row[9]),
      leafColorLabels: list(row[10]),
      minimumTemperatureCelsius: integer(row[11]),
      foliagePersistence: persistence,
      spacingCm: integer(row[13]),
      plantingSeasons: seasons(row[14]),
      photo: null,
    };
    const issues = validatePlantWriteInput(input);
    if (issues.length > 0) {
      const details = issues
        .map(({ field, message }) => `${field}: ${message}`)
        .join('; ');
      throw new Error(`Ligne ${rowIndex + 2} (${name}) : ${details}`);
    }

    yield input;
  }
}

function escapeCsvValue(value: string): string {
  return /[",\n\r]/u.test(value) ? `"${value.replace(/"/gu, '""')}"` : value;
}

function joinCsvList(values: readonly string[]): string {
  return values.join('|');
}

function exposureLabel(value: ExposureCode): string {
  switch (value) {
    case 'sun':
      return 'Soleil';
    case 'partial_shade':
      return 'Mi-ombre';
    case 'shade':
      return 'Ombre';
  }
}

function kindLabel(value: PlantKind | null): string {
  switch (value) {
    case 'flower':
      return 'Fleur';
    case 'foliage':
      return 'Feuillage';
    case 'grass':
      return 'Graminee';
    case 'other':
      return 'Autre';
    case null:
      return '';
  }
}

function foliagePersistenceLabel(value: Plant['foliagePersistence']): string {
  switch (value) {
    case 'evergreen':
      return 'oui';
    case 'semi_evergreen':
      return 'semi';
    case 'deciduous':
      return 'non';
    case null:
      return '';
  }
}

function plantingSeasonLabel(value: PlantingSeasonCode): string {
  switch (value) {
    case 'spring':
      return 'Printemps';
    case 'summer':
      return 'Ete';
    case 'autumn':
      return 'Automne';
    case 'winter':
      return 'Hiver';
  }
}

export class CsvPlantCatalogImporter implements PlantCatalogImporter {
  importData(csv: string): DataImportResult<PlantWriteInput> {
    const errors = validateCatalogCsvStructure(csv);
    if (errors.length > 0) {
      return { ok: false, errors };
    }

    try {
      return { ok: true, records: [...plantInputs(csv)] };
    } catch (error) {
      return {
        ok: false,
        errors: [
          issue(
            'invalid_catalog_row',
            error instanceof Error
              ? error.message
              : "Une ligne du catalogue n'a pas pu être importée.",
          ),
        ],
      };
    }
  }
}

export class CsvPlantCatalogExporter implements PlantCatalogExporter {
  exportData(plants: readonly Plant[]): string {
    const rows = plants.map((plant) => [
      plant.name,
      plant.heightCm?.min?.toString() ?? '',
      plant.heightCm?.max?.toString() ?? '',
      plant.type?.label ?? '',
      kindLabel(plant.kind),
      joinCsvList(plant.soils.map(({ label }) => label)),
      joinCsvList(plant.exposures.map(exposureLabel)),
      plant.bloom ? (MONTH_LABELS[plant.bloom.startMonth] ?? '') : '',
      plant.bloom ? (MONTH_LABELS[plant.bloom.endMonth] ?? '') : '',
      joinCsvList(plant.flowerColors.map(({ label }) => label)),
      joinCsvList(plant.leafColors.map(({ label }) => label)),
      plant.minimumTemperatureCelsius?.toString() ?? '',
      foliagePersistenceLabel(plant.foliagePersistence),
      plant.spacingCm?.toString() ?? '',
      joinCsvList(plant.plantingSeasons.map(plantingSeasonLabel)),
    ]);
    return [CATALOG_CSV_HEADERS, ...rows]
      .map((row) => row.map(escapeCsvValue).join(','))
      .join('\n');
  }
}
