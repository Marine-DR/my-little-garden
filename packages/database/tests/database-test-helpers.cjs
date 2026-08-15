const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { databaseMigrationFilenames } = require('../dist');

const migration = databaseMigrationFilenames
  .map((filename) =>
    readFileSync(join(__dirname, '..', 'migrations', filename), 'utf8'),
  )
  .join('\n');

function createDatabase(t) {
  const database = new DatabaseSync(':memory:');
  database.exec(migration);
  t.after(() => database.close());
  return database;
}

function insertPlant(database, id, name, normalizedName) {
  database
    .prepare(
      `INSERT INTO plants (
         id, name, normalized_name, created_at, updated_at
       ) VALUES (?, ?, ?, '2026-08-15', '2026-08-15')`,
    )
    .run(id, name, normalizedName);
}

module.exports = { createDatabase, insertPlant };
