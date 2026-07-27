import { describePlantChanges, type Plant } from '@my-little-garden/core';
import type {
  PlantCatalogRepository,
  SelectionCreationInput,
  SelectionCreationResult,
  SelectionDetailsRecord,
  SelectionModifiedPlantRecord,
  SelectionPlantAdditionInput,
  SelectionPlantAdditionResult,
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
    private readonly plantRepository: PlantCatalogRepository,
  ) {}

  private allPlantsExist(plantIds: readonly string[]): boolean {
    const placeholders = plantIds.map(() => '?').join(', ');
    const existingPlantIds = new Set(
      this.database
        .prepare(`SELECT id FROM plants WHERE id IN (${placeholders})`)
        .all(...plantIds)
        .map((row) => stringColumn(row as SqliteRow, 'id')),
    );
    return plantIds.every((plantId) => existingPlantIds.has(plantId));
  }

  private statusFor(
    selectionId: string,
  ): 'up_to_date' | 'contains_modified_plants' {
    const pending = this.database
      .prepare(
        `SELECT 1 FROM selection_plant_changes
         WHERE selection_id = ? AND change_kind = 'modified' LIMIT 1`,
      )
      .get(selectionId);
    return pending ? 'contains_modified_plants' : 'up_to_date';
  }

  private modifiedPlantCountFor(selectionId: string): number {
    const row = this.database
      .prepare(
        `SELECT count(*) AS count FROM selection_plant_changes
         WHERE selection_id = ? AND change_kind = 'modified'`,
      )
      .get(selectionId) as SqliteRow;
    return numberColumn(row, 'count');
  }

  private modifiedPlantsFor(
    selectionId: string,
    plants: readonly Plant[],
  ): readonly SelectionModifiedPlantRecord[] {
    return this.database
      .prepare(
        `SELECT plant_id, plant_name, baseline_json FROM selection_plant_changes
         WHERE selection_id = ? AND change_kind = 'modified'
         ORDER BY plant_name COLLATE NOCASE, plant_id`,
      )
      .all(selectionId)
      .map((row) => {
        const change = row as SqliteRow;
        const plant = plants.find(
          ({ id }) => id === stringColumn(change, 'plant_id'),
        );
        const baselineJson = nullableStringColumn(change, 'baseline_json');
        return {
          id: stringColumn(change, 'plant_id'),
          name: stringColumn(change, 'plant_name'),
          attributes:
            plant && baselineJson
              ? describePlantChanges(JSON.parse(baselineJson) as Plant, plant)
              : [],
        };
      });
  }

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
      status: this.statusFor(selection.id),
      modifiedPlantCount: this.modifiedPlantCountFor(selection.id),
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
    const plants = await this.plantRepository.listByIds(plantIds);
    return {
      id: stringColumn(selection, 'id'),
      name: stringColumn(selection, 'name'),
      status: this.statusFor(selectionId),
      modifiedPlantCount: this.modifiedPlantCountFor(selectionId),
      modifiedPlants: this.modifiedPlantsFor(selectionId, plants),
      plants,
    };
  }

  async removePlants(
    selectionId: string,
    plantIds: readonly string[],
  ): Promise<SelectionDetailsRecord | null> {
    const selectionExists = this.database
      .prepare('SELECT 1 FROM selections WHERE id = ?')
      .get(selectionId);
    if (!selectionExists) {
      return null;
    }

    const uniquePlantIds = [...new Set(plantIds)];
    if (uniquePlantIds.length > 0) {
      runInTransaction(this.database, () => {
        const placeholders = uniquePlantIds.map(() => '?').join(', ');
        const result = this.database
          .prepare(
            `DELETE FROM selection_plants
             WHERE selection_id = ? AND plant_id IN (${placeholders})`,
          )
          .run(selectionId, ...uniquePlantIds);
        if (result.changes > 0) {
          this.database
            .prepare('UPDATE selections SET updated_at = ? WHERE id = ?')
            .run(new Date().toISOString(), selectionId);
        }
      });
    }

    return this.get(selectionId);
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

      if (!this.allPlantsExist(plantIds)) {
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

  async addPlants(
    input: SelectionPlantAdditionInput,
  ): Promise<SelectionPlantAdditionResult> {
    const selectionId = input.selectionId.trim();
    const plantIds = [...new Set(input.plantIds)];

    if (!selectionId) {
      return { ok: false, code: 'no_selection' };
    }
    if (plantIds.length === 0) {
      return { ok: false, code: 'no_plants' };
    }

    return runInTransaction(this.database, () => {
      const selection = this.database
        .prepare('SELECT name FROM selections WHERE id = ?')
        .get(selectionId) as SqliteRow | undefined;
      if (!selection) {
        return { ok: false, code: 'selection_not_found' };
      }

      if (!this.allPlantsExist(plantIds)) {
        return { ok: false, code: 'unknown_plants' };
      }

      const now = new Date().toISOString();
      const insertPlant = this.database.prepare(
        `INSERT OR IGNORE INTO selection_plants (
           selection_id, plant_id, added_at
         ) VALUES (?, ?, ?)`,
      );
      let addedCount = 0;
      for (const plantId of plantIds) {
        addedCount += Number(
          insertPlant.run(selectionId, plantId, now).changes,
        );
      }
      if (addedCount > 0) {
        this.database
          .prepare('UPDATE selections SET updated_at = ? WHERE id = ?')
          .run(now, selectionId);
      }

      return {
        ok: true,
        selectionId,
        selectionName: stringColumn(selection, 'name'),
        addedCount,
        ignoredCount: plantIds.length - addedCount,
      };
    });
  }

  async acknowledgeModifiedPlants(
    selectionId: string,
  ): Promise<SelectionDetailsRecord | null> {
    const selectionExists = this.database
      .prepare('SELECT 1 FROM selections WHERE id = ?')
      .get(selectionId);
    if (!selectionExists) {
      return null;
    }
    this.database
      .prepare(
        `DELETE FROM selection_plant_changes
         WHERE selection_id = ? AND change_kind = 'modified'`,
      )
      .run(selectionId);
    return this.get(selectionId);
  }
}
