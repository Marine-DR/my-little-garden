import {
  hasSameMaterialPlantRecord,
  normalizeDatabaseKey,
  planCatalogReplacement,
  type Plant,
  type CatalogImportPlantRecord,
  type CatalogReplacementCommit,
  type PlantCatalogReplacementRepository,
  type PlantCatalogReplacementSnapshotRepository,
  type PlantWriteInput,
} from '@my-little-garden/core';
import type { DatabaseSync } from 'node:sqlite';
import { runInTransaction } from './transaction';

function vocabularyId(
  database: DatabaseSync,
  table: 'plant_types' | 'soil_types' | 'colors',
  label: string,
): number {
  const normalized = normalizeDatabaseKey(label);
  const existing = database
    .prepare(`SELECT id FROM ${table} WHERE normalized_label = ?`)
    .get(normalized);
  if (existing) {
    return Number(existing.id);
  }
  const result = database
    .prepare(
      `INSERT INTO ${table} (label, normalized_label, created_at) VALUES (?, ?, ?) RETURNING id`,
    )
    .get(label, normalized, new Date().toISOString());
  return Number(result?.id);
}

export class SqliteCatalogReplacement implements PlantCatalogReplacementRepository {
  constructor(
    private readonly database: DatabaseSync,
    private readonly snapshotRepository: PlantCatalogReplacementSnapshotRepository,
  ) {}

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
      for (const plant of plan.deleted) {
        this.recordDeletedPlant(plant, now);
      }
      if (plan.deleted.length > 0) {
        const placeholders = plan.deleted.map(() => '?').join(', ');
        this.database
          .prepare(`DELETE FROM plants WHERE id IN (${placeholders})`)
          .run(...plan.deleted.map(({ id }) => id));
      }
      for (const { existing, input } of plan.changed) {
        this.recordModifiedPlant(existing, input, now);
        this.upsertPlant(input, now);
        this.replaceRelations(input);
      }
      for (const input of plan.created) {
        this.upsertPlant(input, now);
        this.replaceRelations(input);
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

  private recordDeletedPlant(plant: Plant, now: string): void {
    this.database
      .prepare(
        `INSERT INTO selection_plant_changes (
           selection_id, plant_id, change_kind, plant_name, baseline_json,
           created_at, updated_at, photo_managed_filename
         )
         SELECT sp.selection_id, p.id, 'deleted', p.name, NULL, ?, ?,
                ph.managed_filename
         FROM selection_plants sp
         JOIN plants p ON p.id = sp.plant_id
         LEFT JOIN plant_photos ph ON ph.plant_id = p.id
         WHERE p.id = ?
         ON CONFLICT(selection_id, plant_id) DO UPDATE SET
           change_kind = 'deleted',
           plant_name = excluded.plant_name,
           baseline_json = NULL,
           updated_at = excluded.updated_at,
           photo_managed_filename = excluded.photo_managed_filename`,
      )
      .run(now, now, plant.id);
    this.touchSelections(plant.id, now);
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

  private upsertPlant(plant: PlantWriteInput, now: string): void {
    const { id } = plant;
    this.database
      .prepare(
        `INSERT INTO plants (
          id, name, normalized_name, height_min_cm, height_max_cm, type_id, plant_kind,
          bloom_start_month, bloom_end_month, minimum_temperature_celsius,
          foliage_persistence, spacing_cm, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          normalized_name = excluded.normalized_name,
          height_min_cm = excluded.height_min_cm,
          height_max_cm = excluded.height_max_cm,
          type_id = excluded.type_id,
          plant_kind = excluded.plant_kind,
          bloom_start_month = excluded.bloom_start_month,
          bloom_end_month = excluded.bloom_end_month,
          minimum_temperature_celsius = excluded.minimum_temperature_celsius,
          foliage_persistence = excluded.foliage_persistence,
          spacing_cm = excluded.spacing_cm,
          updated_at = excluded.updated_at`,
      )
      .run(
        id,
        plant.name,
        normalizeDatabaseKey(plant.name),
        plant.heightCm?.min ?? null,
        plant.heightCm?.max ?? null,
        plant.typeLabel
          ? vocabularyId(this.database, 'plant_types', plant.typeLabel)
          : null,
        plant.kind,
        plant.bloom?.startMonth ?? null,
        plant.bloom?.endMonth ?? null,
        plant.minimumTemperatureCelsius,
        plant.foliagePersistence,
        plant.spacingCm,
        now,
        now,
      );
  }

  private replaceRelations(plant: PlantWriteInput): void {
    const { id } = plant;
    this.database.prepare('DELETE FROM plant_soils WHERE plant_id = ?').run(id);
    this.database
      .prepare('DELETE FROM plant_exposures WHERE plant_id = ?')
      .run(id);
    this.database
      .prepare('DELETE FROM plant_flower_colors WHERE plant_id = ?')
      .run(id);
    this.database
      .prepare('DELETE FROM plant_leaf_colors WHERE plant_id = ?')
      .run(id);
    this.database
      .prepare('DELETE FROM plant_planting_seasons WHERE plant_id = ?')
      .run(id);

    for (const soil of plant.soilLabels) {
      this.database
        .prepare(
          'INSERT INTO plant_soils (plant_id, soil_type_id) VALUES (?, ?)',
        )
        .run(id, vocabularyId(this.database, 'soil_types', soil));
    }
    for (const code of plant.exposures) {
      this.database
        .prepare(
          'INSERT INTO plant_exposures (plant_id, exposure_code) VALUES (?, ?)',
        )
        .run(id, code);
    }
    for (const color of plant.flowerColorLabels) {
      this.database
        .prepare(
          'INSERT INTO plant_flower_colors (plant_id, color_id) VALUES (?, ?)',
        )
        .run(id, vocabularyId(this.database, 'colors', color));
    }
    for (const color of plant.leafColorLabels) {
      this.database
        .prepare(
          'INSERT INTO plant_leaf_colors (plant_id, color_id) VALUES (?, ?)',
        )
        .run(id, vocabularyId(this.database, 'colors', color));
    }
    for (const code of plant.plantingSeasons) {
      this.database
        .prepare(
          'INSERT INTO plant_planting_seasons (plant_id, season_code) VALUES (?, ?)',
        )
        .run(id, code);
    }
  }
}
