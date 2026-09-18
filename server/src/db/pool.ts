import { Pool } from 'pg';
import './timestampParser.js';

// Same DB_PORT override as migrate-config.js / scripts/seed.ts, kept independent of them:
// this is the app's own runtime connection, not the migration/seed tooling's.
export const pool = new Pool({
  host: 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'weekwise',
});

// An idle client that loses its connection (e.g. `docker compose restart db`) emits 'error' on
// the pool; with no listener, Node treats it as an unhandled 'error' event and the process
// exits (R1 #4). Logging and continuing lets `pg` reconnect a fresh client on the next query,
// which is its own documented behaviour for this event.
pool.on('error', (error) => {
  console.error('Unexpected error on idle Postgres client', error);
});
