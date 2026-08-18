export const upsertPlantPhotoQuery = `INSERT INTO plant_photos
  (plant_id, managed_filename, media_type, checksum_sha256, created_at)
VALUES (?, ?, ?, ?, ?)
ON CONFLICT(plant_id) DO UPDATE SET
  managed_filename = excluded.managed_filename,
  media_type = excluded.media_type,
  checksum_sha256 = excluded.checksum_sha256,
  created_at = excluded.created_at`;
