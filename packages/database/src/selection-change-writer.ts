import type { DatabaseSync } from 'node:sqlite';
import { inClausePlaceholders } from './query-builders';

function insertDeletedPlantChangesQuery(placeholders: string): string {
  return `INSERT INTO selection_plant_changes (
    selection_id, plant_id, change_kind, plant_name,
    baseline_json, created_at, updated_at, photo_managed_filename
  )
  SELECT sp.selection_id, p.id, 'deleted', p.name,
         NULL, ?, ?, ph.managed_filename
  FROM selection_plants sp
  JOIN plants p ON p.id = sp.plant_id
  LEFT JOIN plant_photos ph ON ph.plant_id = p.id
  WHERE p.id IN (${placeholders})
  ON CONFLICT(selection_id, plant_id) DO UPDATE SET
    change_kind = 'deleted',
    plant_name = excluded.plant_name,
    baseline_json = NULL,
    updated_at = excluded.updated_at,
    photo_managed_filename = excluded.photo_managed_filename`;
}

function touchSelectionsForPlantsQuery(placeholders: string): string {
  return `UPDATE selections SET updated_at = ?
    WHERE id IN (
      SELECT DISTINCT selection_id FROM selection_plants
      WHERE plant_id IN (${placeholders})
    )`;
}

/** Records deletion snapshots and touches affected selections before deletion. */
export function recordDeletedPlantChanges(
  database: DatabaseSync,
  plantIds: readonly string[],
  now: string,
): void {
  const placeholders = inClausePlaceholders(plantIds.length);
  database
    .prepare(insertDeletedPlantChangesQuery(placeholders))
    .run(now, now, ...plantIds);
  database
    .prepare(touchSelectionsForPlantsQuery(placeholders))
    .run(now, ...plantIds);
}
