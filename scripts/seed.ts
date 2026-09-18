import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import migrateConfig from '../migrate-config.js';
import { seedDatabase } from '../server/src/db/seed.js';

// Reuses migrate-config.js's connection details (including the DB_PORT override) so this
// script and node-pg-migrate never fall out of sync on host/port/user/password/database.
const client = new Client(migrateConfig.db);

const __dirname = dirname(fileURLToPath(import.meta.url));
const seedPath = resolve(__dirname, '../seed/seed.sql');

async function main() {
  await client.connect();
  try {
    await seedDatabase(client, seedPath);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
