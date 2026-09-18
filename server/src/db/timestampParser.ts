import { types } from 'pg';

/**
 * `pg` parses `timestamp` (no time zone) columns using the Node process's local time zone by
 * default. Every `occurred_at` value in the seed is UTC, and the app buckets by local time
 * itself (PLAN.md §5), so this pins the parser to UTC regardless of what TZ the process runs
 * under. A side-effecting import: `pg.types.setTypeParser` is a module-global registration, not
 * per-`Pool`, so this only needs to run once per process.
 *
 * Imported by both `pool.ts` (production) and the `sql`/`api` test projects' setup file (R1
 * #10) — one pin, not two copies that could drift apart.
 */
const TIMESTAMP_OID = 1114;
types.setTypeParser(TIMESTAMP_OID, (value: string) => new Date(`${value}Z`));
