import type {
  FlowerbedDesign,
  FlowerbedPlantPlacement,
  FlowerbedRepository,
  FlowerbedSaveInput,
  FlowerbedSummary,
  FlowerbedZone,
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

function decodeSummary(row: SqliteRow): FlowerbedSummary {
  return {
    id: stringColumn(row, 'id'),
    name: stringColumn(row, 'name'),
    selectionId: nullableStringColumn(row, 'selection_id'),
    widthCm: numberColumn(row, 'width_cm'),
    heightCm: numberColumn(row, 'height_cm'),
    zoneCount: numberColumn(row, 'zone_count'),
    placementCount: numberColumn(row, 'placement_count'),
    createdAt: stringColumn(row, 'created_at'),
    updatedAt: stringColumn(row, 'updated_at'),
  };
}

function decodeZone(row: SqliteRow): FlowerbedZone {
  return {
    id: stringColumn(row, 'id'),
    xCm: numberColumn(row, 'x_cm'),
    yCm: numberColumn(row, 'y_cm'),
    widthCm: numberColumn(row, 'width_cm'),
    heightCm: numberColumn(row, 'height_cm'),
  };
}

function decodePlacement(row: SqliteRow): FlowerbedPlantPlacement {
  return {
    id: stringColumn(row, 'id'),
    zoneId: nullableStringColumn(row, 'planting_zone_id'),
    plantId: nullableStringColumn(row, 'plant_id'),
    plantNameSnapshot: stringColumn(row, 'plant_name_snapshot'),
    spacingCmSnapshot: numberColumn(row, 'spacing_cm_snapshot'),
    colorSnapshot: nullableStringColumn(row, 'color_snapshot'),
    xCm: numberColumn(row, 'x_cm'),
    yCm: numberColumn(row, 'y_cm'),
  };
}

const summaryQuery = `
  SELECT f.id, f.name, f.selection_id, f.width_cm, f.height_cm,
         f.created_at, f.updated_at,
         (SELECT count(*) FROM planting_zones z
          WHERE z.flowerbed_id = f.id) AS zone_count,
         (SELECT count(*) FROM flowerbed_plant_placements p
          WHERE p.flowerbed_id = f.id) AS placement_count
  FROM flowerbeds f`;

function requireFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number.`);
  }
}

function validateInput(input: FlowerbedSaveInput): string {
  const name = input.name.trim();
  if (!name) {
    throw new TypeError('Flowerbed name must not be empty.');
  }
  requireFinite(input.widthCm, 'widthCm');
  requireFinite(input.heightCm, 'heightCm');
  if (input.widthCm <= 0 || input.heightCm <= 0) {
    throw new RangeError('Flowerbed dimensions must be greater than zero.');
  }
  for (const zone of input.zones) {
    requireFinite(zone.xCm, 'zone.xCm');
    requireFinite(zone.yCm, 'zone.yCm');
    requireFinite(zone.widthCm, 'zone.widthCm');
    requireFinite(zone.heightCm, 'zone.heightCm');
    if (zone.widthCm <= 0 || zone.heightCm <= 0) {
      throw new RangeError(
        'Planting zone dimensions must be greater than zero.',
      );
    }
  }
  for (const placement of input.placements) {
    requireFinite(placement.xCm, 'placement.xCm');
    requireFinite(placement.yCm, 'placement.yCm');
    requireFinite(placement.spacingCmSnapshot, 'placement.spacingCmSnapshot');
    if (!placement.plantNameSnapshot.trim()) {
      throw new TypeError('Plant snapshot name must not be empty.');
    }
    if (placement.spacingCmSnapshot < 0) {
      throw new RangeError('Plant snapshot spacing must not be negative.');
    }
  }
  return name;
}

export class SqliteFlowerbedRepository implements FlowerbedRepository {
  constructor(private readonly database: DatabaseSync) {}

  async list(): Promise<FlowerbedSummary[]> {
    return this.database
      .prepare(
        `${summaryQuery} ORDER BY f.updated_at DESC, f.name COLLATE NOCASE, f.id`,
      )
      .all()
      .map((row) => decodeSummary(row as SqliteRow));
  }

  async get(flowerbedId: string): Promise<FlowerbedDesign | null> {
    const row = this.database
      .prepare(`${summaryQuery} WHERE f.id = ?`)
      .get(flowerbedId) as SqliteRow | undefined;
    if (!row) {
      return null;
    }
    const summary = decodeSummary(row);
    const zones = this.database
      .prepare(
        `SELECT id, x_cm, y_cm, width_cm, height_cm
         FROM planting_zones WHERE flowerbed_id = ? ORDER BY rowid`,
      )
      .all(flowerbedId)
      .map((zone) => decodeZone(zone as SqliteRow));
    const placements = this.database
      .prepare(
        `SELECT id, planting_zone_id, plant_id, plant_name_snapshot,
                spacing_cm_snapshot, color_snapshot, x_cm, y_cm
         FROM flowerbed_plant_placements
         WHERE flowerbed_id = ? ORDER BY rowid`,
      )
      .all(flowerbedId)
      .map((placement) => decodePlacement(placement as SqliteRow));
    return { ...summary, zones, placements };
  }

  async save(input: FlowerbedSaveInput): Promise<FlowerbedDesign> {
    const name = validateInput(input);
    const flowerbedId = input.id ?? randomUUID();
    const existing = input.id
      ? this.database
          .prepare('SELECT created_at FROM flowerbeds WHERE id = ?')
          .get(input.id)
      : undefined;
    if (input.id && !existing) {
      throw new Error(`Flowerbed ${input.id} does not exist.`);
    }
    const suppliedZoneIds = input.zones.flatMap((zone) =>
      zone.id ? [zone.id] : [],
    );
    if (new Set(suppliedZoneIds).size !== suppliedZoneIds.length) {
      throw new Error('Planting zone IDs must be unique.');
    }
    const existingZoneIds = new Set(
      existing
        ? this.database
            .prepare('SELECT id FROM planting_zones WHERE flowerbed_id = ?')
            .all(flowerbedId)
            .map((row) => stringColumn(row as SqliteRow, 'id'))
        : [],
    );
    const zoneIds = input.zones.map((zone) =>
      zone.id && existingZoneIds.has(zone.id) ? zone.id : randomUUID(),
    );
    const savedZoneIdByInputId = new Map<string, string>();
    input.zones.forEach((zone, index) => {
      if (zone.id) {
        savedZoneIdByInputId.set(zone.id, zoneIds[index]!);
      }
    });
    for (const placement of input.placements) {
      if (
        placement.zoneId !== null &&
        !savedZoneIdByInputId.has(placement.zoneId)
      ) {
        throw new Error(
          `Placement references unknown zone ${placement.zoneId}.`,
        );
      }
    }
    const suppliedPlacementIds = input.placements.flatMap((placement) =>
      placement.id ? [placement.id] : [],
    );
    if (new Set(suppliedPlacementIds).size !== suppliedPlacementIds.length) {
      throw new Error('Plant placement IDs must be unique.');
    }
    const existingPlacementIds = new Set(
      existing
        ? this.database
            .prepare(
              `SELECT id FROM flowerbed_plant_placements
               WHERE flowerbed_id = ?`,
            )
            .all(flowerbedId)
            .map((row) => stringColumn(row as SqliteRow, 'id'))
        : [],
    );
    const placementIds = input.placements.map((placement) =>
      placement.id && existingPlacementIds.has(placement.id)
        ? placement.id
        : randomUUID(),
    );

    const now = new Date().toISOString();
    runInTransaction(this.database, () => {
      if (existing) {
        this.database
          .prepare(
            `UPDATE flowerbeds SET name = ?, selection_id = ?, width_cm = ?,
             height_cm = ?, updated_at = ? WHERE id = ?`,
          )
          .run(
            name,
            input.selectionId,
            input.widthCm,
            input.heightCm,
            now,
            flowerbedId,
          );
        this.database
          .prepare(
            'DELETE FROM flowerbed_plant_placements WHERE flowerbed_id = ?',
          )
          .run(flowerbedId);
        this.database
          .prepare('DELETE FROM planting_zones WHERE flowerbed_id = ?')
          .run(flowerbedId);
      } else {
        this.database
          .prepare(
            `INSERT INTO flowerbeds (
              id, name, selection_id, width_cm, height_cm, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            flowerbedId,
            name,
            input.selectionId,
            input.widthCm,
            input.heightCm,
            now,
            now,
          );
      }

      const insertZone = this.database.prepare(
        `INSERT INTO planting_zones (
          id, flowerbed_id, x_cm, y_cm, width_cm, height_cm
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      input.zones.forEach((zone, index) => {
        insertZone.run(
          zoneIds[index]!,
          flowerbedId,
          zone.xCm,
          zone.yCm,
          zone.widthCm,
          zone.heightCm,
        );
      });

      const insertPlacement = this.database.prepare(
        `INSERT INTO flowerbed_plant_placements (
          id, flowerbed_id, planting_zone_id, plant_id, plant_name_snapshot,
          spacing_cm_snapshot, color_snapshot, x_cm, y_cm
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      input.placements.forEach((placement, index) => {
        insertPlacement.run(
          placementIds[index]!,
          flowerbedId,
          placement.zoneId === null
            ? null
            : savedZoneIdByInputId.get(placement.zoneId)!,
          placement.plantId,
          placement.plantNameSnapshot.trim(),
          placement.spacingCmSnapshot,
          placement.colorSnapshot?.trim() || null,
          placement.xCm,
          placement.yCm,
        );
      });
    });

    const saved = await this.get(flowerbedId);
    if (!saved) {
      throw new Error(`Saved flowerbed ${flowerbedId} could not be read.`);
    }
    return saved;
  }

  async delete(flowerbedId: string): Promise<boolean> {
    return (
      this.database
        .prepare('DELETE FROM flowerbeds WHERE id = ?')
        .run(flowerbedId).changes > 0
    );
  }
}
