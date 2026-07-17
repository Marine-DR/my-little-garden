import { CsvPlantCatalogImporter } from '@my-little-garden/communication';
import type {
  DataImportError,
  PlantCatalogReplacementRepository,
} from '@my-little-garden/core';
import { SqliteCatalogReplacement } from '@my-little-garden/database';
import type { DatabaseSync } from 'node:sqlite';

export function validateCatalogCsvStructure(
  csv: string,
): readonly DataImportError[] {
  const result = new CsvPlantCatalogImporter().importData(csv);
  return result.ok ? [] : result.errors;
}

export function replaceCatalogFromCsv(
  database: DatabaseSync,
  csv: string,
): number {
  const importer = new CsvPlantCatalogImporter();
  const result = importer.importData(csv);
  if (!result.ok) {
    throw new Error(result.errors.map(({ message }) => message).join('\n'));
  }

  const repository: PlantCatalogReplacementRepository =
    new SqliteCatalogReplacement(database);
  return repository.replace(result.records);
}

export function seedDemoCatalog(database: DatabaseSync, csv: string): number {
  return replaceCatalogFromCsv(database, csv);
}
