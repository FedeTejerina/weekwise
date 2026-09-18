import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getAccountWeekRanges,
  getAsOf,
  getWeeklyLocationCounts,
  type WeeklyLocationCounts,
} from '../../src/db/aggregation.js';

let pool: Pool;
let rows: WeeklyLocationCounts[];

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  rows = await getWeeklyLocationCounts(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('as-of, default week, and the full-week range (T4 bullet 1)', () => {
  it('as-of is the latest occurred_at in the dataset', async () => {
    expect(await getAsOf(pool)).toBe('2026-07-27 22:20:34');
  });

  it('every account computes the same default week and earliest full week', async () => {
    const ranges = await getAccountWeekRanges(pool);
    expect(ranges).toHaveLength(20);
    for (const range of ranges) {
      expect(range.defaultWeek).toBe('2026-07-20');
      expect(range.earliestFullWeek).toBe('2026-02-02');
    }
  });

  it('spans exactly 25 full weeks', () => {
    const weeks = new Set(rows.map((r) => r.weekStart));
    expect(weeks.size).toBe(25);
    expect([...weeks].sort()[0]).toBe('2026-02-02');
    expect([...weeks].sort().at(-1)).toBe('2026-07-20');
  });
});

describe('zero-filled weekly rows, one per location (T4 bullet 2)', () => {
  it('is 69 locations x 25 weeks = 1725 rows', () => {
    const locations = new Set(rows.map((r) => `${r.accountId}:${r.location}`));
    expect(locations.size).toBe(69);
    expect(rows).toHaveLength(69 * 25);
  });

  it('gives every location all 25 weeks, including weeks with zero events', () => {
    const weeksByLocation = new Map<string, Set<string>>();
    for (const row of rows) {
      const key = `${row.accountId}:${row.location}`;
      const weeks = weeksByLocation.get(key) ?? new Set<string>();
      weeks.add(row.weekStart);
      weeksByLocation.set(key, weeks);
    }
    for (const weeks of weeksByLocation.values()) {
      expect(weeks.size).toBe(25);
    }
    expect(rows.some((r) => r.calls === 0 && r.leads === 0 && r.appointments === 0)).toBe(true);
  });
});

describe('post-dedup totals (T4 bullet 3, and the §12 dedup check)', () => {
  it('sums to 12,517 events: 7,708 calls, 3,023 leads, 1,786 appointments', () => {
    const totals = rows.reduce(
      (acc, r) => ({
        calls: acc.calls + r.calls,
        leads: acc.leads + r.leads,
        appointments: acc.appointments + r.appointments,
      }),
      { calls: 0, leads: 0, appointments: 0 },
    );
    expect(totals).toEqual({ calls: 7708, leads: 3023, appointments: 1786 });
    expect(totals.calls + totals.leads + totals.appointments).toBe(12517);
  });
});

describe('local-week bucketing, New York case (T4 bullet 4)', () => {
  it('2026-06-03 02:30 UTC lands on local date 2026-06-02, week of 2026-06-01', async () => {
    const { rows: nyRows } = await pool.query<{ localTs: string; weekStart: string }>(`
      SELECT
        (('2026-06-03 02:30:00'::timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::text AS "localTs",
        date_trunc(
          'week',
          ('2026-06-03 02:30:00'::timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York'
        )::date::text AS "weekStart"
    `);
    const { localTs, weekStart } = nyRows[0]!;
    expect(localTs.startsWith('2026-06-02')).toBe(true);
    expect(weekStart).toBe('2026-06-01');
  });
});

describe('account 20 (zero events) and the partial week (§12 data-handling checks)', () => {
  it('account 20 still gets a valid week range, without erroring', async () => {
    const ranges = await getAccountWeekRanges(pool);
    const account20 = ranges.find((r) => r.accountId === 20);
    expect(account20).toBeDefined();
    expect(account20?.defaultWeek).toBe('2026-07-20');
    expect(account20?.earliestFullWeek).toBe('2026-02-02');
  });

  it('account 20 contributes no location rows — it has no locations to report', () => {
    expect(rows.some((r) => r.accountId === 20)).toBe(false);
  });

  it('never evaluates the in-progress week of 2026-07-27', async () => {
    const weeks = new Set(rows.map((r) => r.weekStart));
    expect(weeks.has('2026-07-27')).toBe(false);

    const ranges = await getAccountWeekRanges(pool);
    for (const range of ranges) {
      expect(range.defaultWeek).not.toBe('2026-07-27');
    }
  });
});
