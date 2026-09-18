// `sql`/`api` tests create their own `Pool`/`Client` directly (a dynamic testcontainers
// connection string), never importing `server/src/db/pool.ts` — so they need this pin
// registered independently. Reuses the exact same module `pool.ts` imports (R1 #10), rather
// than a second copy of the `pg.types.setTypeParser` call that could drift from it.
import '../../src/db/timestampParser.js';
