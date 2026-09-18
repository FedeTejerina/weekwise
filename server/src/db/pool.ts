import { Pool } from 'pg';

// Same DB_PORT override as migrate-config.js / scripts/seed.ts, kept independent of them:
// this is the app's own runtime connection, not the migration/seed tooling's.
export const pool = new Pool({
  host: 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'weekwise',
});
