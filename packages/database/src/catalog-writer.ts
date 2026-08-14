import type { PlantWriteInput } from '@my-little-garden/core';
import { normalizeDatabaseKey } from '@my-little-garden/core';
import type { DatabaseSync } from 'node:sqlite';

const vocabularyQueries = {
  referential_plant_types: {
    findId: 'SELECT id FROM referential_plant_types WHERE normalized_label = ?',
    insert: `INSERT INTO referential_plant_types
      (label, normalized_label, created_at) VALUES (?, ?, ?) RETURNING id`,
  },
  referential_plant_kinds: {
    findId: 'SELECT id FROM referential_plant_kinds WHERE normalized_label = ?',
    insert: `INSERT INTO referential_plant_kinds
      (label, normalized_label, created_at) VALUES (?, ?, ?) RETURNING id`,
  },
  referential_soil_types: {
    findId: 'SELECT id FROM referential_soil_types WHERE normalized_label = ?',
    insert: `INSERT INTO referential_soil_types
      (label, normalized_label, created_at) VALUES (?, ?, ?) RETURNING id`,
  },
  referential_colors: {
    findId: 'SELECT id FROM referential_colors WHERE normalized_label = ?',
    insert: `INSERT INTO referential_colors
      (label, normalized_label, created_at) VALUES (?, ?, ?) RETURNING id`,
  },
} as const;

type VocabularyTable = keyof typeof vocabularyQueries;

const upsertPlantQuery = `INSERT INTO plants (
  id, name, normalized_name, height_min_cm, height_max_cm, type_id,
  bloom_start_month, bloom_end_month, minimum_temperature_celsius,
  foliage_persistence, spacing_cm, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  name = excluded.name,
  normalized_name = excluded.normalized_name,
  height_min_cm = excluded.height_min_cm,
  height_max_cm = excluded.height_max_cm,
  type_id = excluded.type_id,
  bloom_start_month = excluded.bloom_start_month,
  bloom_end_month = excluded.bloom_end_month,
  minimum_temperature_celsius = excluded.minimum_temperature_celsius,
  foliage_persistence = excluded.foliage_persistence,
  spacing_cm = excluded.spacing_cm,
  updated_at = excluded.updated_at`;

const relationQueries = {
  kinds: {
    delete: 'DELETE FROM plant_kind_assignments WHERE plant_id = ?',
    insert:
      'INSERT INTO plant_kind_assignments (plant_id, plant_kind_id) VALUES (?, ?)',
  },
  soils: {
    delete: 'DELETE FROM plant_soils WHERE plant_id = ?',
    insert: 'INSERT INTO plant_soils (plant_id, soil_type_id) VALUES (?, ?)',
  },
  exposures: {
    delete: 'DELETE FROM plant_exposures WHERE plant_id = ?',
    insert:
      'INSERT INTO plant_exposures (plant_id, exposure_code) VALUES (?, ?)',
  },
  flowerColors: {
    delete: 'DELETE FROM plant_flower_colors WHERE plant_id = ?',
    insert:
      'INSERT INTO plant_flower_colors (plant_id, color_id) VALUES (?, ?)',
  },
  leafColors: {
    delete: 'DELETE FROM plant_leaf_colors WHERE plant_id = ?',
    insert: 'INSERT INTO plant_leaf_colors (plant_id, color_id) VALUES (?, ?)',
  },
  plantingSeasons: {
    delete: 'DELETE FROM plant_planting_seasons WHERE plant_id = ?',
    insert:
      'INSERT INTO plant_planting_seasons (plant_id, season_code) VALUES (?, ?)',
  },
} as const;

/** Shared write operations used by incremental import and full replacement. */
export class CatalogWriter {
  constructor(private readonly database: DatabaseSync) {}

  upsertPlant(plant: PlantWriteInput, now: string): void {
    this.database
      .prepare(upsertPlantQuery)
      .run(
        plant.id,
        plant.name,
        normalizeDatabaseKey(plant.name),
        plant.heightCm?.min ?? null,
        plant.heightCm?.max ?? null,
        plant.typeLabel
          ? this.vocabularyId('referential_plant_types', plant.typeLabel)
          : null,
        plant.bloom?.startMonth ?? null,
        plant.bloom?.endMonth ?? null,
        plant.minimumTemperatureCelsius,
        plant.foliagePersistence,
        plant.spacingCm,
        now,
        now,
      );
  }

  replaceRelations(plant: PlantWriteInput): void {
    const { id } = plant;
    for (const query of Object.values(relationQueries)) {
      this.database.prepare(query.delete).run(id);
    }

    const insertKinds = this.database.prepare(relationQueries.kinds.insert);
    for (const kind of plant.kindLabels) {
      insertKinds.run(id, this.vocabularyId('referential_plant_kinds', kind));
    }

    const insertSoils = this.database.prepare(relationQueries.soils.insert);
    for (const soil of plant.soilLabels) {
      insertSoils.run(id, this.vocabularyId('referential_soil_types', soil));
    }

    const insertExposures = this.database.prepare(
      relationQueries.exposures.insert,
    );
    for (const code of plant.exposures) {
      insertExposures.run(id, code);
    }

    const insertFlowerColors = this.database.prepare(
      relationQueries.flowerColors.insert,
    );
    for (const color of plant.flowerColorLabels) {
      insertFlowerColors.run(
        id,
        this.vocabularyId('referential_colors', color),
      );
    }

    const insertLeafColors = this.database.prepare(
      relationQueries.leafColors.insert,
    );
    for (const color of plant.leafColorLabels) {
      insertLeafColors.run(id, this.vocabularyId('referential_colors', color));
    }

    const insertPlantingSeasons = this.database.prepare(
      relationQueries.plantingSeasons.insert,
    );
    for (const code of plant.plantingSeasons) {
      insertPlantingSeasons.run(id, code);
    }
  }

  private vocabularyId(table: VocabularyTable, label: string): number {
    const normalized = normalizeDatabaseKey(label);
    const queries = vocabularyQueries[table];
    const existing = this.database.prepare(queries.findId).get(normalized);
    if (existing) {
      return Number(existing.id);
    }
    const result = this.database
      .prepare(queries.insert)
      .get(label, normalized, new Date().toISOString());
    return Number(result?.id);
  }
}
