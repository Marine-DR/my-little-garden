import type { DatabaseSync } from 'node:sqlite';

export interface PlantPhotoTarget {
  readonly plantId: string;
  readonly plantName: string;
  readonly managedFilename: string | null;
}

export interface PlantPhotoRecord {
  readonly plantId: string;
  readonly managedFilename: string;
  readonly mediaType: string;
  readonly checksumSha256: string;
  readonly createdAt: string;
}

export class SqlitePlantPhotoRepository {
  constructor(private readonly database: DatabaseSync) {}

  listTargets(): PlantPhotoTarget[] {
    return this.database
      .prepare(
        `SELECT plants.id AS plant_id, plants.name AS plant_name,
          plant_photos.managed_filename AS managed_filename
        FROM plants
        LEFT JOIN plant_photos ON plant_photos.plant_id = plants.id`,
      )
      .all()
      .map((row) => ({
        plantId: String(row.plant_id),
        plantName: String(row.plant_name),
        managedFilename: row.managed_filename
          ? String(row.managed_filename)
          : null,
      }));
  }

  upsert(record: PlantPhotoRecord): void {
    this.database
      .prepare(
        `INSERT INTO plant_photos
          (plant_id, managed_filename, media_type, checksum_sha256, created_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(plant_id) DO UPDATE SET
          managed_filename = excluded.managed_filename,
          media_type = excluded.media_type,
          checksum_sha256 = excluded.checksum_sha256,
          created_at = excluded.created_at`,
      )
      .run(
        record.plantId,
        record.managedFilename,
        record.mediaType,
        record.checksumSha256,
        record.createdAt,
      );
  }

  deleteByPlantId(plantId: string): string | null {
    const row = this.database
      .prepare('SELECT managed_filename FROM plant_photos WHERE plant_id = ?')
      .get(plantId);
    if (!row) {
      return null;
    }
    this.database
      .prepare('DELETE FROM plant_photos WHERE plant_id = ?')
      .run(plantId);
    return String(row.managed_filename);
  }
}
