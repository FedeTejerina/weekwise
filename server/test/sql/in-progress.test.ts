import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildVerdict,
  evaluateAccountWeekFromData,
  fetchWeeklyCheckData,
  inProgressFor,
  weeklyCheck,
  type WeeklyCheckData,
} from '../../src/weeklyCheck.js';

/** T9 (D18): the in-progress week line, end to end. */

let pool: Pool;
let data: WeeklyCheckData;

beforeAll(async () => {
  pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  data = await fetchWeeklyCheckData(pool);
});

afterAll(async () => {
  await pool.end();
});

describe('inProgress (D18)', () => {
  it.each([
    [6, 7],
    [5, 6],
    [12, 6],
    [1, 3],
    [2, 0],
    [8, 0],
    [20, 0],
  ])('account %i -> { weekStart: "2026-07-27", daysIn: 1, count: %i }', (accountId, count) => {
    expect(inProgressFor(data, accountId, 'call_received')).toEqual({
      weekStart: '2026-07-27',
      daysIn: 1,
      count,
    });
  });

  it("the 2026-07-20 verdict is deep-equal whether inProgress is computed or stubbed out", () => {
    const withInProgress = evaluateAccountWeekFromData(data, 6, 'call_received', '2026-07-20');
    const verdictWith = buildVerdict(withInProgress.accountResult);

    // "Stubbed out": inProgressRows never populated at all, not just ignored downstream.
    const stubbedData: WeeklyCheckData = { ...data, inProgressRows: [] };
    const withoutInProgress = evaluateAccountWeekFromData(stubbedData, 6, 'call_received', '2026-07-20');
    const verdictWithout = buildVerdict(withoutInProgress.accountResult);

    expect(verdictWithout).toEqual(verdictWith);
    expect(withoutInProgress.locationEvaluations).toEqual(withInProgress.locationEvaluations);
    // And inProgressFor itself simply can't resolve anything from the stubbed data.
    expect(inProgressFor(stubbedData, 6, 'call_received')).toBeNull();
  });

  it('is present on the full weeklyCheck() response and never inside the verdict object', async () => {
    const response = await weeklyCheck(pool, 6, 'call_received', '2026-06-01');
    expect(response.inProgress).toEqual({ weekStart: '2026-07-27', daysIn: 1, count: 7 });
    expect(response.verdict).not.toHaveProperty('inProgress');
  });
});
