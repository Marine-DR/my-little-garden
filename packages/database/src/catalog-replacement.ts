import {
  normalizeDatabaseKey,
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

export class SqliteCatalogReplacement {
  constructor(private readonly database: DatabaseSync) {}

  replace(plants: Iterable<PlantWriteInput>): number {
    const now = new Date().toISOString();
    let imported = 0;
    return runInTransaction(this.database, () => {
      this.database.exec('DELETE FROM plants');
      for (const plant of plants) {
        this.insertPlant(plant, now);
        imported += 1;
      }
      return imported;
    });
  }

  private insertPlant(plant: PlantWriteInput, now: string): void {
    const { id } = plant;
    this.database
      .prepare(
        `INSERT INTO plants (
          id, name, normalized_name, height_min_cm, height_max_cm, type_id, plant_kind,
          bloom_start_month, bloom_end_month, minimum_temperature_celsius,
          foliage_persistence, spacing_cm, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
