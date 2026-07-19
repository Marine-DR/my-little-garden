import type {
  SelectionCreationInput,
  SelectionCreationResult,
  SelectionDetailsRecord,
  PlantCatalogRepository,
  SelectionRepository,
  SelectionSummaryRecord,
} from '@my-little-garden/core';
import { randomUUID } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import {
  nullableStringColumn,
  numberColumn,
  stringColumn,
  type SqliteRow,
} from './typed-query';
import { runInTransaction } from './transaction';

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

export class SqliteSelectionRepository implements SelectionRepository {
  constructor(
    private readonly database: DatabaseSync,
    private readonly plantRepository: Pick<PlantCatalogRepository, 'listByIds'>,
  ) {}

  async listSummaries(): Promise<SelectionSummaryRecord[]> {
    const selections = this.database
      .prepare(
        `SELECT s.id, s.name, s.created_at, s.updated_at,
                count(sp.plant_id) AS plant_count
         FROM selections s
         LEFT JOIN selection_plants sp ON sp.selection_id = s.id
         GROUP BY s.id, s.name, s.created_at, s.updated_at
         ORDER BY s.updated_at DESC, s.name COLLATE NOCASE, s.id`,
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

  async get(selectionId: string): Promise<SelectionDetailsRecord | null> {
    const selection = this.database
      .prepare('SELECT id, name FROM selections WHERE id = ?')
      .get(selectionId) as SqliteRow | undefined;
    if (!selection) {
      return null;
    }
    const plantIds = this.database
      .prepare(
        `SELECT plant_id FROM selection_plants
         WHERE selection_id = ? ORDER BY added_at, plant_id`,
      )
      .all(selectionId)
      .map((row) => stringColumn(row as SqliteRow, 'plant_id'));
    return {
      id: stringColumn(selection, 'id'),
      name: stringColumn(selection, 'name'),
      plants: await this.plantRepository.listByIds(plantIds),
    };
  }

  async create(
    input: SelectionCreationInput,
  ): Promise<SelectionCreationResult> {
    const name = input.name.trim();
    const plantIds = [...new Set(input.plantIds)];

    if (!name) {
      return { ok: false, code: 'empty_name' };
    }
    if (plantIds.length === 0) {
      return { ok: false, code: 'no_plants' };
    }

    return runInTransaction(this.database, () => {
      const duplicate = this.database
        .prepare('SELECT 1 FROM selections WHERE name = ?')
        .get(name);
      if (duplicate) {
        return { ok: false, code: 'duplicate_name' };
      }

      const placeholders = plantIds.map(() => '?').join(', ');
      const existingPlants = this.database
        .prepare(
          `SELECT count(*) AS count FROM plants WHERE id IN (${placeholders})`,
        )
        .get(...plantIds) as { count: number };
      if (existingPlants.count !== plantIds.length) {
        return { ok: false, code: 'unknown_plants' };
      }

      const selectionId = randomUUID();
      const now = new Date().toISOString();
      this.database
        .prepare(
          `INSERT INTO selections (
             id, name, created_at, updated_at
           ) VALUES (?, ?, ?, ?)`,
        )
        .run(selectionId, name, now, now);
      const insertPlant = this.database.prepare(
        `INSERT INTO selection_plants (selection_id, plant_id, added_at)
         VALUES (?, ?, ?)`,
      );
      for (const plantId of plantIds) {
        insertPlant.run(selectionId, plantId, now);
      }

      return {
        ok: true,
        selectionId,
        name,
        plantCount: plantIds.length,
      };
    });
  }
}
