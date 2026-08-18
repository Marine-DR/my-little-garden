import {
  hasSameMaterialPlantRecord,
  planCatalogReplacement,
  type Plant,
  type CatalogImportPlantRecord,
  type CatalogReplacementCommit,
  type PlantCatalogReplacementRepository,
  type PlantCatalogReplacementSnapshotRepository,
  type PlantWriteInput,
} from '@my-little-garden/core';
import type { DatabaseSync } from 'node:sqlite';
import { CatalogWriter } from './catalog-writer';
import { inClausePlaceholders } from './query-builders';
import { recordDeletedPlantChanges } from './selection-change-writer';
import { runInTransaction } from './transaction';

export class SqliteCatalogReplacement implements PlantCatalogReplacementRepository {
  private readonly writer: CatalogWriter;

  constructor(
    private readonly database: DatabaseSync,
    private readonly snapshotRepository: PlantCatalogReplacementSnapshotRepository,
  ) {
    this.writer = new CatalogWriter(database);
  }

  replace(
    plants: Iterable<CatalogImportPlantRecord>,
  ): CatalogReplacementCommit {
    const importedPlants = [...plants];
    const obsoletePhotoFilenames = this.database
      .prepare('SELECT managed_filename FROM plant_photos')
      .all()
      .map((row) => String(row.managed_filename));
    const now = new Date().toISOString();
    const imported = runInTransaction(this.database, () => {
      const existingPlants = this.snapshotRepository.listAllForReplacement();
      const plan = planCatalogReplacement(existingPlants, importedPlants);
      if (plan.deleted.length > 0) {
        const deletedPlantIds = plan.deleted.map(({ id }) => id);
        recordDeletedPlantChanges(this.database, deletedPlantIds, now);
        const placeholders = inClausePlaceholders(deletedPlantIds.length);
        this.database
          .prepare(`DELETE FROM plants WHERE id IN (${placeholders})`)
          .run(...deletedPlantIds);
      }
      for (const { existing, input } of plan.changed) {
        this.recordModifiedPlant(existing, input, now);
        this.writer.upsertPlant(input, now);
        this.writer.replaceRelations(input);
      }
      for (const input of plan.created) {
        this.writer.upsertPlant(input, now);
        this.writer.replaceRelations(input);
      }
      return importedPlants.length;
    });
    const retainedPhotoFilenames = new Set(
      this.database
        .prepare(
          `SELECT managed_filename AS filename FROM plant_photos
           UNION SELECT photo_managed_filename AS filename
           FROM selection_plant_changes WHERE photo_managed_filename IS NOT NULL`,
        )
        .all()
        .map((row) => String(row.filename)),
    );
    return {
      imported,
      obsoleteManagedPhotoFilenames: obsoletePhotoFilenames.filter(
        (filename) => !retainedPhotoFilenames.has(filename),
      ),
    };
  }

  private recordModifiedPlant(
    existing: Plant,
    imported: PlantWriteInput,
    now: string,
  ): void {
    const selections = this.database
      .prepare('SELECT selection_id FROM selection_plants WHERE plant_id = ?')
      .all(existing.id);
    for (const row of selections) {
      const selectionId = String(row.selection_id);
      const pending = this.database
        .prepare(
          `SELECT change_kind, baseline_json FROM selection_plant_changes
           WHERE selection_id = ? AND plant_id = ?`,
        )
        .get(selectionId, existing.id);
      if (
        pending?.change_kind === 'modified' &&
        typeof pending.baseline_json === 'string' &&
        hasSameMaterialPlantRecord(
          JSON.parse(pending.baseline_json) as Plant,
          imported,
        )
      ) {
        this.database
          .prepare(
            `DELETE FROM selection_plant_changes
             WHERE selection_id = ? AND plant_id = ?`,
          )
          .run(selectionId, existing.id);
        continue;
      }
      this.database
        .prepare(
          `INSERT OR IGNORE INTO selection_plant_changes (
             selection_id, plant_id, change_kind, plant_name, baseline_json,
             created_at, updated_at
           ) VALUES (?, ?, 'modified', ?, ?, ?, ?)`,
        )
        .run(
          selectionId,
          existing.id,
          existing.name,
          JSON.stringify(existing),
          now,
          now,
        );
    }
    this.touchSelections(existing.id, now);
  }

  private touchSelections(plantId: string, now: string): void {
    this.database
      .prepare(
        `UPDATE selections SET updated_at = ?
         WHERE id IN (
           SELECT selection_id FROM selection_plants WHERE plant_id = ?
         )`,
      )
      .run(now, plantId);
  }
}
