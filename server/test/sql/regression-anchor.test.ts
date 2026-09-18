import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  evaluateAccountWeekFromData,
  fetchWeeklyCheckData,
  weekListFrom,
  type EventType,
  type WeeklyCheckData,
} from '../../src/weeklyCheck.js';

/**
 * T15 — the regression anchor (§12). Evaluates every account and location across the weeks
 * the location gate can reach, 2026-05-18 .. 2026-07-20, and asserts the E9 anchor exactly as
 * `PLAN.md` §4/§12 publish it. If a count differs here, the number is re-measured with T5b
 * (`scripts/measure-anchor.py`), never adjusted by hand (§12) — and per CLAUDE.md rule 4, a fix
 * on either side gets stated explicitly for the other.
 *
 * Goes through `evaluateAccountWeekFromData` — the exact function `weeklyCheck()` calls, not a
 * parallel reimplementation of the loop over accounts/locations/weeks.
 */

const EVENT_TYPES: EventType[] = ['call_received', 'lead_created', 'appointment_set'];
const SINGLE_SITE_ACCOUNTS = new Set([8, 13, 16, 19]);

/** The location gate's minimum history is 16 full weeks (D8): weeks[15] is 2026-05-18. */
const LOCATION_EVALUABLE_FROM_INDEX = 15;
/** The account verdict's minimum history is 13 full weeks (D8): weeks[12] is 2026-04-27. */
const ACCOUNT_EVALUABLE_FROM_INDEX = 12;

let pool: Pool;
let data: WeeklyCheckData;

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  data = await fetchWeeklyCheckData(pool);
});

afterAll(async () => {
  await pool.end();
});

function weeksFor(accountId: number): string[] {
  const range = data.ranges.find((r) => r.accountId === accountId);
  if (!range) throw new Error(`no week range for account ${accountId}`);
  return weekListFrom(range.earliestFullWeek, range.defaultWeek);
}

function accountIdsExcept(...excluded: number[]): number[] {
  return data.accounts.map((a) => a.id).filter((id) => !excluded.includes(id));
}

describe('regression anchor (T15 / §12)', () => {
  it('every account and location share the same evaluable range, 2026-05-18 .. 2026-07-20', () => {
    for (const accountId of accountIdsExcept()) {
      const weeks = weeksFor(accountId);
      expect(weeks).toHaveLength(25);
      expect(weeks[LOCATION_EVALUABLE_FROM_INDEX]).toBe('2026-05-18');
      expect(weeks.at(-1)).toBe('2026-07-20');
    }
  });

  it('15/15 account-6 locations flagged up for calls on 2026-06-01', () => {
    // Computed on the 804 deduplicated events of 2026-06-03 (T4/T14), not the 805 raw rows —
    // this test only checks the gate's verdict on that count, not the count itself.
    const evaluation = evaluateAccountWeekFromData(data, 6, 'call_received', '2026-06-01');
    expect(evaluation.locationEvaluations).toHaveLength(15);
    const upFlags = evaluation.locationEvaluations.filter((l) => l.result.state === 'flagged_up');
    expect(upFlags).toHaveLength(15);
    expect(evaluation.accountResult.count).toBe(528);
  });

  it('0 echo drops for account-6 locations, on all three event types, in every evaluable week', () => {
    const weeks = weeksFor(6).slice(LOCATION_EVALUABLE_FROM_INDEX);
    let echoDrops = 0;
    for (const eventType of EVENT_TYPES) {
      for (const week of weeks) {
        const evaluation = evaluateAccountWeekFromData(data, 6, eventType, week);
        echoDrops += evaluation.locationEvaluations.filter((l) => l.result.state === 'flagged_down').length;
      }
    }
    expect(echoDrops).toBe(0);
  });

  it('location flags excluding account 6: gate level 4/4/9, renderable (multi-site only) 4/3/9', () => {
    const gate: Record<EventType, number> = { call_received: 0, lead_created: 0, appointment_set: 0 };
    const renderable: Record<EventType, number> = { call_received: 0, lead_created: 0, appointment_set: 0 };

    // Only account 6 is excluded here — the anchor's own definition names no other exclusion.
    // Account 20 needs no special-casing: it has zero locations (T4/T14), so it would
    // contribute nothing to either count whether or not it's in this loop.
    for (const accountId of accountIdsExcept(6)) {
      const weeks = weeksFor(accountId).slice(LOCATION_EVALUABLE_FROM_INDEX);
      for (const eventType of EVENT_TYPES) {
        for (const week of weeks) {
          const evaluation = evaluateAccountWeekFromData(data, accountId, eventType, week);
          const flaggedCount = evaluation.locationEvaluations.filter(
            (l) => l.result.state === 'flagged_up' || l.result.state === 'flagged_down',
          ).length;
          gate[eventType] += flaggedCount;
          if (!SINGLE_SITE_ACCOUNTS.has(accountId)) {
            renderable[eventType] += flaggedCount;
          }
        }
      }
    }

    expect(EVENT_TYPES.map((et) => gate[et])).toEqual([4, 4, 9]);
    expect(EVENT_TYPES.map((et) => renderable[et])).toEqual([4, 3, 9]);
    // The gap is exactly one row: account 19, Site A, week of 2026-05-18, leads. D16 suppresses
    // it because account 19 is single-site — asserting both numbers makes that suppression a
    // tested behaviour, not an accident (this is also why account 19 must stay IN the gate-level
    // loop above and only excluded from `renderable`, never excluded from both).
    expect(gate.lead_created - renderable.lead_created).toBe(1);
  });

  it("verdict flags: 10/5/3 of 246, excluding only account 6's 2026-06-01 cell", () => {
    // Account 20 (zero events ever) is excluded entirely — 19 accounts, not 20 — because it
    // has no history to evaluate, not because it's silently "quiet" (gate.ts's `hasAnyEvent`,
    // log I21). Account 6's *other* weeks are still counted; only this one cell is masked,
    // exactly as the §4 erratum (log I7) states.
    const flags: Record<EventType, number> = { call_received: 0, lead_created: 0, appointment_set: 0 };
    let totalCells = 0;

    for (const accountId of accountIdsExcept(20)) {
      const weeks = weeksFor(accountId).slice(ACCOUNT_EVALUABLE_FROM_INDEX);
      for (const week of weeks) {
        if (accountId === 6 && week === '2026-06-01') continue;
        totalCells += 1;
        for (const eventType of EVENT_TYPES) {
          const evaluation = evaluateAccountWeekFromData(data, accountId, eventType, week);
          if (evaluation.accountResult.state === 'flagged_up' || evaluation.accountResult.state === 'flagged_down') {
            flags[eventType] += 1;
          }
        }
      }
    }

    expect(totalCells).toBe(246);
    expect(EVENT_TYPES.map((et) => flags[et])).toEqual([10, 5, 3]);
  });
});
