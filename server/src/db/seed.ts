import { readFileSync } from 'node:fs';
import type { ClientBase } from 'pg';

/**
 * Loads `seed/seed.sql` in one transaction. `seed/` is read-only material (CLAUDE.md rule 3):
 * read here, never written to. Shared by `scripts/seed.ts` and the `sql` test project's global
 * setup, so both go through the exact same loading path.
 */
export async function seedDatabase(client: ClientBase, seedSqlPath: string): Promise<void> {
  const seedSql = readFileSync(seedSqlPath, 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(seedSql);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
