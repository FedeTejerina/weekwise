import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/api.js';

/** T8: Fastify API, exercised via `app.inject()` — no open port needed. Own ephemeral
 * Postgres container, same global setup as the `sql` project (see vitest.config.ts), so this
 * runs standalone with `npm test -- api`. */

let pool: Pool;
let app: ReturnType<typeof buildApp>;

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  app = buildApp(pool);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

describe('GET /api/accounts', () => {
  it('returns all 20 accounts with a location count, account 20 included at 0', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/accounts' });
    expect(response.statusCode).toBe(200);
    const accounts = response.json();
    expect(accounts).toHaveLength(20);
    const account20 = accounts.find((a: { id: number }) => a.id === 20);
    expect(account20).toMatchObject({ locationCount: 0 });
    const account6 = accounts.find((a: { id: number }) => a.id === 6);
    expect(account6).toMatchObject({ name: 'Metro Collision Centers', locationCount: 15 });
  });
});

describe('GET /api/weekly-check — the four verdict states', () => {
  it('flagged_up — account 6, calls, 2026-06-01', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/weekly-check?account=6&type=call_received&week=2026-06-01',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().verdict).toMatchObject({ state: 'flagged_up', count: 528 });
  });

  it('flagged_down — account 7, calls, 2026-07-13', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/weekly-check?account=7&type=call_received&week=2026-07-13',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().verdict).toMatchObject({ state: 'flagged_down', count: 3 });
  });

  it('quiet — account 1, calls, 2026-07-20', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/weekly-check?account=1&type=call_received&week=2026-07-20',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.verdict).toMatchObject({ state: 'quiet', count: 34 });
    expect(body.verdict).not.toHaveProperty('changePct');
  });

  it('not_enough_history — account 20, no error', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/weekly-check?account=20&type=call_received&week=2026-07-20',
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().verdict).toEqual({ state: 'not_enough_history' });
  });
});

describe('single-site omission (D16)', () => {
  it('accounts 16 and 19 have no "locations" key at all', async () => {
    for (const accountId of [16, 19]) {
      const response = await app.inject({
        method: 'GET',
        url: `/api/weekly-check?account=${accountId}&type=call_received&week=2026-07-20`,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).not.toHaveProperty('locations');
    }
  });
});

describe('D15 — invalid or out-of-range parameters fall back to defaults, never a 400', () => {
  it('?account=999&type=nonsense&week=1999-01-01 returns 200 with the defaults applied', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/weekly-check?account=999&type=nonsense&week=1999-01-01',
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.account.id).toBe(1);
    expect(body.week.start).toBe(body.weeks.at(-1));
    // The response itself doesn't name the event type — confirmed indirectly: account 1's
    // default week is quiet for calls (verified in T7/T15), which is what actually comes back.
    expect(body.verdict).toMatchObject({ state: 'quiet', count: 34 });
  });
});
