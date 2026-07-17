import type { Plant, PlantWriteInput } from './plant';

export interface DataImportError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}

export type DataImportResult<TRecord> =
  | { readonly ok: true; readonly records: readonly TRecord[] }
  | { readonly ok: false; readonly errors: readonly DataImportError[] };

export interface DataImporter<TInput, TRecord> {
  importData(input: TInput): DataImportResult<TRecord>;
}

export interface DataExporter<TRecord, TOutput> {
  exportData(records: readonly TRecord[]): TOutput;
}

export type PlantCatalogImporter = DataImporter<string, PlantWriteInput>;

export type PlantCatalogExporter = DataExporter<Plant, string>;
