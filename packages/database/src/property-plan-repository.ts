import type {
  Flowerbed,
  PropertyBoundaryPoint,
  PropertyPlanDesign,
  PropertyPlanPlantPlacement,
  PropertyPlanRepository,
  PropertyPlanSaveInput,
  PropertyPlanSummary,
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

function decodeSummary(row: SqliteRow): PropertyPlanSummary {
  return {
    id: stringColumn(row, 'id'),
    name: stringColumn(row, 'name'),
    selectionId: nullableStringColumn(row, 'selection_id'),
    widthCm: numberColumn(row, 'width_cm'),
    heightCm: numberColumn(row, 'height_cm'),
    flowerbedCount: numberColumn(row, 'flowerbed_count'),
    placementCount: numberColumn(row, 'placement_count'),
    createdAt: stringColumn(row, 'created_at'),
    updatedAt: stringColumn(row, 'updated_at'),
  };
}

function decodeFlowerbed(row: SqliteRow): Omit<Flowerbed, 'boundaryPoints'> {
  return {
    id: stringColumn(row, 'id'),
    xCm: numberColumn(row, 'x_cm'),
    yCm: numberColumn(row, 'y_cm'),
    widthCm: numberColumn(row, 'width_cm'),
    heightCm: numberColumn(row, 'height_cm'),
  };
}

function decodeBoundaryPoint(row: SqliteRow): PropertyBoundaryPoint {
  return {
    xCm: numberColumn(row, 'x_cm'),
    yCm: numberColumn(row, 'y_cm'),
  };
}

function rectangularBoundary(
  widthCm: number,
  heightCm: number,
): readonly PropertyBoundaryPoint[] {
  return [
    { xCm: 0, yCm: 0 },
    { xCm: widthCm, yCm: 0 },
    { xCm: widthCm, yCm: heightCm },
    { xCm: 0, yCm: heightCm },
  ];
}

function rectangularFlowerbedBoundary(
  flowerbed: Pick<Flowerbed, 'xCm' | 'yCm' | 'widthCm' | 'heightCm'>,
): readonly PropertyBoundaryPoint[] {
  return [
    { xCm: flowerbed.xCm, yCm: flowerbed.yCm },
    { xCm: flowerbed.xCm + flowerbed.widthCm, yCm: flowerbed.yCm },
    {
      xCm: flowerbed.xCm + flowerbed.widthCm,
      yCm: flowerbed.yCm + flowerbed.heightCm,
    },
    { xCm: flowerbed.xCm, yCm: flowerbed.yCm + flowerbed.heightCm },
  ];
}

function decodePlacement(row: SqliteRow): PropertyPlanPlantPlacement {
  return {
    id: stringColumn(row, 'id'),
    flowerbedId: nullableStringColumn(row, 'flowerbed_id'),
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
         (SELECT count(*) FROM flowerbeds b
          WHERE b.property_plan_id = f.id) AS flowerbed_count,
         (SELECT count(*) FROM property_plan_plant_placements p
          WHERE p.property_plan_id = f.id) AS placement_count
  FROM property_plans f`;

function requireFinite(value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number.`);
  }
}

function validateInput(input: PropertyPlanSaveInput): string {
  const name = input.name.trim();
  if (!name) {
    throw new TypeError('Property plan name must not be empty.');
  }
  requireFinite(input.widthCm, 'widthCm');
  requireFinite(input.heightCm, 'heightCm');
  if (input.widthCm <= 0 || input.heightCm <= 0) {
    throw new RangeError('Property dimensions must be greater than zero.');
  }
  const boundaryPoints =
    input.propertyBoundaryPoints ??
    rectangularBoundary(input.widthCm, input.heightCm);
  if (boundaryPoints.length !== 4) {
    throw new RangeError('A property boundary must contain four points.');
  }
  for (const point of boundaryPoints) {
    requireFinite(point.xCm, 'boundaryPoint.xCm');
    requireFinite(point.yCm, 'boundaryPoint.yCm');
  }
  for (const flowerbed of input.flowerbeds) {
    requireFinite(flowerbed.xCm, 'flowerbed.xCm');
    requireFinite(flowerbed.yCm, 'flowerbed.yCm');
    requireFinite(flowerbed.widthCm, 'flowerbed.widthCm');
    requireFinite(flowerbed.heightCm, 'flowerbed.heightCm');
    if (flowerbed.widthCm <= 0 || flowerbed.heightCm <= 0) {
      throw new RangeError('Flowerbed dimensions must be greater than zero.');
    }
    const flowerbedBoundary =
      flowerbed.boundaryPoints ?? rectangularFlowerbedBoundary(flowerbed);
    if (flowerbedBoundary.length !== 4) {
      throw new RangeError('A flowerbed boundary must contain four points.');
    }
    for (const point of flowerbedBoundary) {
      requireFinite(point.xCm, 'flowerbed.boundaryPoint.xCm');
      requireFinite(point.yCm, 'flowerbed.boundaryPoint.yCm');
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

export class SqlitePropertyPlanRepository implements PropertyPlanRepository {
  constructor(private readonly database: DatabaseSync) {}

  async list(): Promise<PropertyPlanSummary[]> {
    return this.database
      .prepare(
        `${summaryQuery} ORDER BY f.updated_at DESC, f.name COLLATE NOCASE, f.id`,
      )
      .all()
      .map((row) => decodeSummary(row as SqliteRow));
  }

  async get(propertyPlanId: string): Promise<PropertyPlanDesign | null> {
    const row = this.database
      .prepare(`${summaryQuery} WHERE f.id = ?`)
      .get(propertyPlanId) as SqliteRow | undefined;
    if (!row) {
      return null;
    }
    const summary = decodeSummary(row);
    const propertyBoundaryPoints = this.database
      .prepare(
        `SELECT x_cm, y_cm FROM property_boundary_points
         WHERE property_plan_id = ? ORDER BY position`,
      )
      .all(propertyPlanId)
      .map((point) => decodeBoundaryPoint(point as SqliteRow));
    const flowerbeds = this.database
      .prepare(
        `SELECT id, x_cm, y_cm, width_cm, height_cm
         FROM flowerbeds WHERE property_plan_id = ? ORDER BY rowid`,
      )
      .all(propertyPlanId)
      .map((flowerbed) => decodeFlowerbed(flowerbed as SqliteRow))
      .map((flowerbed) => ({
        ...flowerbed,
        boundaryPoints: this.database
          .prepare(
            `SELECT x_cm, y_cm FROM flowerbed_boundary_points
             WHERE flowerbed_id = ? ORDER BY position`,
          )
          .all(flowerbed.id)
          .map((point) => decodeBoundaryPoint(point as SqliteRow)),
      }));
    const placements = this.database
      .prepare(
        `SELECT id, flowerbed_id, plant_id, plant_name_snapshot,
                spacing_cm_snapshot, color_snapshot, x_cm, y_cm
         FROM property_plan_plant_placements
         WHERE property_plan_id = ? ORDER BY rowid`,
      )
      .all(propertyPlanId)
      .map((placement) => decodePlacement(placement as SqliteRow));
    return { ...summary, propertyBoundaryPoints, flowerbeds, placements };
  }

  async save(input: PropertyPlanSaveInput): Promise<PropertyPlanDesign> {
    const name = validateInput(input);
    const propertyBoundaryPoints =
      input.propertyBoundaryPoints ??
      rectangularBoundary(input.widthCm, input.heightCm);
    const propertyPlanId = input.id ?? randomUUID();
    const existing = input.id
      ? this.database
          .prepare('SELECT created_at FROM property_plans WHERE id = ?')
          .get(input.id)
      : undefined;
    if (input.id && !existing) {
      throw new Error(`Property plan ${input.id} does not exist.`);
    }
    const suppliedFlowerbedIds = input.flowerbeds.flatMap((flowerbed) =>
      flowerbed.id ? [flowerbed.id] : [],
    );
    if (new Set(suppliedFlowerbedIds).size !== suppliedFlowerbedIds.length) {
      throw new Error('Flowerbed IDs must be unique.');
    }
    const existingFlowerbedIds = new Set(
      existing
        ? this.database
            .prepare('SELECT id FROM flowerbeds WHERE property_plan_id = ?')
            .all(propertyPlanId)
            .map((row) => stringColumn(row as SqliteRow, 'id'))
        : [],
    );
    const flowerbedIds = input.flowerbeds.map((flowerbed) =>
      flowerbed.id && existingFlowerbedIds.has(flowerbed.id)
        ? flowerbed.id
        : randomUUID(),
    );
    const savedFlowerbedIdByInputId = new Map<string, string>();
    input.flowerbeds.forEach((flowerbed, index) => {
      if (flowerbed.id) {
        savedFlowerbedIdByInputId.set(flowerbed.id, flowerbedIds[index]!);
      }
    });
    for (const placement of input.placements) {
      if (
        placement.flowerbedId !== null &&
        !savedFlowerbedIdByInputId.has(placement.flowerbedId)
      ) {
        throw new Error(
          `Placement references unknown flowerbed ${placement.flowerbedId}.`,
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
              `SELECT id FROM property_plan_plant_placements
               WHERE property_plan_id = ?`,
            )
            .all(propertyPlanId)
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
            `UPDATE property_plans SET name = ?, selection_id = ?, width_cm = ?,
             height_cm = ?, updated_at = ? WHERE id = ?`,
          )
          .run(
            name,
            input.selectionId,
            input.widthCm,
            input.heightCm,
            now,
            propertyPlanId,
          );
        this.database
          .prepare(
            'DELETE FROM property_plan_plant_placements WHERE property_plan_id = ?',
          )
          .run(propertyPlanId);
        this.database
          .prepare(
            'DELETE FROM property_boundary_points WHERE property_plan_id = ?',
          )
          .run(propertyPlanId);
        this.database
          .prepare('DELETE FROM flowerbeds WHERE property_plan_id = ?')
          .run(propertyPlanId);
      } else {
        this.database
          .prepare(
            `INSERT INTO property_plans (
              id, name, selection_id, width_cm, height_cm, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            propertyPlanId,
            name,
            input.selectionId,
            input.widthCm,
            input.heightCm,
            now,
            now,
          );
      }

      const insertBoundaryPoint = this.database.prepare(
        `INSERT INTO property_boundary_points (
          property_plan_id, position, x_cm, y_cm
        ) VALUES (?, ?, ?, ?)`,
      );
      propertyBoundaryPoints.forEach((point, position) => {
        insertBoundaryPoint.run(propertyPlanId, position, point.xCm, point.yCm);
      });

      const insertFlowerbed = this.database.prepare(
        `INSERT INTO flowerbeds (
          id, property_plan_id, x_cm, y_cm, width_cm, height_cm
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      );
      input.flowerbeds.forEach((flowerbed, index) => {
        insertFlowerbed.run(
          flowerbedIds[index]!,
          propertyPlanId,
          flowerbed.xCm,
          flowerbed.yCm,
          flowerbed.widthCm,
          flowerbed.heightCm,
        );
      });

      const insertFlowerbedBoundaryPoint = this.database.prepare(
        `INSERT INTO flowerbed_boundary_points (
          flowerbed_id, position, x_cm, y_cm
        ) VALUES (?, ?, ?, ?)`,
      );
      input.flowerbeds.forEach((flowerbed, flowerbedIndex) => {
        const flowerbedBoundary =
          flowerbed.boundaryPoints ?? rectangularFlowerbedBoundary(flowerbed);
        flowerbedBoundary.forEach((point, position) => {
          insertFlowerbedBoundaryPoint.run(
            flowerbedIds[flowerbedIndex]!,
            position,
            point.xCm,
            point.yCm,
          );
        });
      });

      const insertPlacement = this.database.prepare(
        `INSERT INTO property_plan_plant_placements (
          id, property_plan_id, flowerbed_id, plant_id, plant_name_snapshot,
          spacing_cm_snapshot, color_snapshot, x_cm, y_cm
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      input.placements.forEach((placement, index) => {
        insertPlacement.run(
          placementIds[index]!,
          propertyPlanId,
          placement.flowerbedId === null
            ? null
            : savedFlowerbedIdByInputId.get(placement.flowerbedId)!,
          placement.plantId,
          placement.plantNameSnapshot.trim(),
          placement.spacingCmSnapshot,
          placement.colorSnapshot?.trim() || null,
          placement.xCm,
          placement.yCm,
        );
      });
    });

    const saved = await this.get(propertyPlanId);
    if (!saved) {
      throw new Error(
        `Saved property plan ${propertyPlanId} could not be read.`,
      );
    }
    return saved;
  }

  async delete(propertyPlanId: string): Promise<boolean> {
    return (
      this.database
        .prepare('DELETE FROM property_plans WHERE id = ?')
        .run(propertyPlanId).changes > 0
    );
  }
}
