import type { DatabaseSync } from 'node:sqlite';
import {
  nullableStringColumn,
  numberColumn,
  stringColumn,
  type SqliteRow,
} from './typed-query';

export interface SelectionSummaryRecord {
  readonly id: string;
  readonly name: string;
  readonly previewManagedFilenames: readonly (string | null)[];
  readonly plantCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface SelectionRow {
  readonly id: string;
  readonly name: string;
  readonly plantCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

interface PreviewRow {
  readonly selectionId: string;
  readonly managedFilename: string | null;
}

function decodeSelectionRow(row: SqliteRow): SelectionRow {
  return {
    id: stringColumn(row, 'id'),
    name: stringColumn(row, 'name'),
    plantCount: numberColumn(row, 'plant_count'),
    createdAt: stringColumn(row, 'created_at'),
    updatedAt: stringColumn(row, 'updated_at'),
  };
}

function decodePreviewRow(row: SqliteRow): PreviewRow {
  return {
    selectionId: stringColumn(row, 'selection_id'),
    managedFilename: nullableStringColumn(row, 'managed_filename'),
  };
}

export class SqliteSelectionRepository {
  constructor(private readonly database: DatabaseSync) {}

  async listSummaries(): Promise<SelectionSummaryRecord[]> {
    const selections = this.database
      .prepare(
        `SELECT s.id, s.name, s.created_at, s.updated_at,
                count(sp.plant_id) AS plant_count
         FROM selections s
         LEFT JOIN selection_plants sp ON sp.selection_id = s.id
         GROUP BY s.id, s.name, s.created_at, s.updated_at
         ORDER BY s.updated_at DESC, s.normalized_name COLLATE NOCASE, s.id`,
      )
      .all()
      .map((row) => decodeSelectionRow(row as SqliteRow));

    if (selections.length === 0) {
      return [];
    }

    const selectionIds = selections.map(({ id }) => id);
    const placeholders = selectionIds.map(() => '?').join(', ');
    const previewsBySelection = new Map<string, (string | null)[]>();
    const previewRows = this.database
      .prepare(
        `SELECT sp.selection_id, ph.managed_filename
         FROM selection_plants sp
         JOIN plants p ON p.id = sp.plant_id
         LEFT JOIN plant_photos ph ON ph.plant_id = p.id
         WHERE sp.selection_id IN (${placeholders})
         ORDER BY sp.selection_id,
                  p.normalized_name COLLATE NOCASE,
                  p.name COLLATE NOCASE,
                  p.id`,
      )
      .all(...selectionIds)
      .map((row) => decodePreviewRow(row as SqliteRow));

    for (const row of previewRows) {
      const previews = previewsBySelection.get(row.selectionId) ?? [];
      if (previews.length < 4) {
        previews.push(row.managedFilename);
        previewsBySelection.set(row.selectionId, previews);
      }
    }

    return selections.map((selection) => ({
      id: selection.id,
      name: selection.name,
      previewManagedFilenames: previewsBySelection.get(selection.id) ?? [],
      plantCount: selection.plantCount,
      createdAt: selection.createdAt,
      updatedAt: selection.updatedAt,
    }));
  }
}
