import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { runner } from 'node-pg-migrate';
import { Client } from 'pg';
import { seedDatabase } from '../../src/db/seed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

// Runs once for the whole `sql` project (not per test file): one ephemeral Postgres 16
// container, migrated and seeded exactly the way a real clone would be, isolated from
// whatever the developer's own `compose.yaml` database happens to hold.
export default async function setup() {
  const container = await new PostgreSqlContainer('postgres:16')
    .withDatabase('weekwise')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const databaseUrl = container.getConnectionUri();

  await runner({
    databaseUrl,
    dir: resolve(repoRoot, 'migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
  });

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await seedDatabase(client, resolve(repoRoot, 'seed/seed.sql'));
  } finally {
    await client.end();
  }

  process.env.TEST_DATABASE_URL = databaseUrl;

  return async () => {
    await container.stop();
  };
}
