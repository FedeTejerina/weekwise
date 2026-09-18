import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import migrateConfig from '../migrate-config.js';

// Reuses migrate-config.js's connection details (including the DB_PORT override) so this
// script and node-pg-migrate never fall out of sync on host/port/user/password/database.
const client = new Client(migrateConfig.db);

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = resolve(__dirname, '../seed/seed.sql');
// seed/ is read-only material (CLAUDE.md rule 3): read here, never written to.
const seedSql = readFileSync(seedPath, 'utf8');

async function main() {
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(seedSql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
