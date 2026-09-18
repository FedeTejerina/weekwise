import { pool } from '../server/src/db/pool.js';
import {
  getAccountWeekRanges,
  getAsOf,
  getWeeklyLocationCounts,
} from '../server/src/db/aggregation.js';

function check(condition: boolean, message: string): void {
  if (!condition) throw new Error(`FAILED: ${message}`);
  console.log(`ok: ${message}`);
}

async function main() {
  const asOf = await getAsOf(pool);
  console.log(`as-of: ${asOf.replace(' ', 'T')}Z`);
  check(asOf === '2026-07-27 22:20:34', 'as-of is 2026-07-27 22:20:34Z');

  const ranges = await getAccountWeekRanges(pool);
  const defaultWeeks = new Set(ranges.map((r) => r.defaultWeek));
  const earliestWeeks = new Set(ranges.map((r) => r.earliestFullWeek));
  console.log(`default week (all ${ranges.length} accounts): ${[...defaultWeeks].join(', ')}`);
  console.log(`earliest full week (all ${ranges.length} accounts): ${[...earliestWeeks].join(', ')}`);
  check(
    defaultWeeks.size === 1 && defaultWeeks.has('2026-07-20'),
    'every account\'s default week is 2026-07-20',
  );
  check(
    earliestWeeks.size === 1 && earliestWeeks.has('2026-02-02'),
    'every account\'s earliest full week is 2026-02-02',
  );

  const rows = await getWeeklyLocationCounts(pool);
  const locationKeys = new Set(rows.map((r) => `${r.accountId}:${r.location}`));
  const weekStarts = new Set(rows.map((r) => r.weekStart));
  console.log(`rows: ${rows.length}, locations: ${locationKeys.size}, weeks: ${weekStarts.size}`);
  check(locationKeys.size === 69, '69 distinct locations');
  check(weekStarts.size === 25, '25 distinct full weeks (2026-02-02 … 2026-07-20)');
  check(rows.length === 69 * 25, `69 x 25 = 1725 rows (got ${rows.length})`);

  const weeksByLocation = new Map<string, Set<string>>();
  for (const r of rows) {
    const key = `${r.accountId}:${r.location}`;
    (weeksByLocation.get(key) ?? weeksByLocation.set(key, new Set()).get(key)!).add(r.weekStart);
  }
  const gaps = [...weeksByLocation.entries()].filter(([, ws]) => ws.size !== 25);
  check(gaps.length === 0, 'every location has all 25 weeks present, zero-filled — no gaps');

  const totals = rows.reduce(
    (acc, r) => {
      acc.calls += r.calls;
      acc.leads += r.leads;
      acc.appointments += r.appointments;
      return acc;
    },
    { calls: 0, leads: 0, appointments: 0 },
  );
  const total = totals.calls + totals.leads + totals.appointments;
  console.log(
    `post-dedup totals over the 25 full weeks: ${total} events` +
      ` (${totals.calls} calls, ${totals.leads} leads, ${totals.appointments} appointments)`,
  );
  check(
    total === 12517 && totals.calls === 7708 && totals.leads === 3023 && totals.appointments === 1786,
    '12,517 events post-dedup: 7,708 calls, 3,023 leads, 1,786 appointments',
  );

  const { rows: nyRows } = await pool.query<{ localTs: string; weekStart: string }>(`
    SELECT
      (('2026-06-03 02:30:00'::timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York')::text AS "localTs",
      date_trunc(
        'week',
        ('2026-06-03 02:30:00'::timestamp AT TIME ZONE 'UTC') AT TIME ZONE 'America/New_York'
      )::date::text AS "weekStart"
  `);
  // A literal SELECT with no FROM clause always returns exactly one row.
  const { localTs, weekStart } = nyRows[0]!;
  console.log(`2026-06-03 02:30 UTC in America/New_York: local ${localTs}, week starting ${weekStart}`);
  check(localTs.startsWith('2026-06-02'), 'lands on local date 2026-06-02');
  check(weekStart === '2026-06-01', 'in the week starting 2026-06-01');

  console.log('\nAll checks passed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
