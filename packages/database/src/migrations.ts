/** Ordered database migrations. Keep this as the single migration manifest. */
export const databaseMigrationFilenames = [
  '001_initial_schema.sql',
  '002_remove_selection_normalized_name.sql',
  '003_selection_plant_changes.sql',
  '004_deleted_plant_photo.sql',
  '005_property_plans.sql',
] as const;

/** Repairs databases created before the v0.3 catalog vocabulary redesign. */
export const legacyCatalogSchemaMigrationFilename =
  'legacy_v0_2_catalog_schema.sql';
