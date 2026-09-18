import type { Pool } from 'pg';
import { getAccounts, getAccountWeekRanges, getAsOf, getWeeklyLocationCounts } from './db/aggregation.js';
import { evaluateWindow, usualRange, type GateState } from './gate.js';

export type EventType = 'call_received' | 'lead_created' | 'appointment_set';

const COLUMN_BY_EVENT_TYPE: Record<EventType, 'calls' | 'leads' | 'appointments'> = {
  call_received: 'calls',
  lead_created: 'leads',
  appointment_set: 'appointments',
};

/** The account verdict: D10, w=1, k=1. */
const ACCOUNT_WINDOW_WEEKS = 1;
const ACCOUNT_K = 1;

/** The location gate: D3/D4, w=4, k = the account's own location count. */
const LOCATION_WINDOW_WEEKS = 4;

/**
 * D16, generalised: a single location has nothing to compare it against, and zero locations
 * (account 20) has nothing to show at all — both get no `locations` key, not an empty one.
 */
const MIN_LOCATIONS_TO_RENDER = 2;

export interface VerdictResponse {
  state: GateState;
  count?: number;
  typical?: number;
  usualRange?: [number, number];
  /** Present only when flagged (D11): positive above typical, negative below. */
  changePct?: number;
}

export interface LocationFlag {
  location: string;
  state: 'flagged_up' | 'flagged_down';
  count: number;
  usualRange: [number, number];
}

export interface LocationsResponse {
  window: { start: string; end: string };
  flagged: LocationFlag[];
  notEnoughHistory: string[];
  quietCount: number;
}

export interface WeeklyCheckResponse {
  asOf: string;
  week: { start: string; end: string; isLatest: boolean };
  weeks: string[];
  account: { id: number; name: string; locationCount: number };
  verdict: VerdictResponse;
  locations?: LocationsResponse;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekListFrom(earliestFullWeek: string, defaultWeek: string): string[] {
  const weeks: string[] = [];
  let w = earliestFullWeek;
  while (w <= defaultWeek) {
    weeks.push(w);
    w = addDays(w, 7);
  }
  return weeks;
}

function changePctFor(count: number, typical: number): number {
  return Math.round((count / typical - 1) * 100);
}

export async function weeklyCheck(
  pool: Pool,
  accountId: number,
  eventType: EventType,
  weekStart: string,
): Promise<WeeklyCheckResponse> {
  const column = COLUMN_BY_EVENT_TYPE[eventType];

  const [asOfText, accounts, ranges, allLocationRows] = await Promise.all([
    getAsOf(pool),
    getAccounts(pool),
    getAccountWeekRanges(pool),
    getWeeklyLocationCounts(pool),
  ]);
  // getAsOf's `::text` cast avoids pg's Date parsing but leaves a space, not the `T`/`Z` PLAN.md
  // §6 publishes; occurred_at is already UTC, so this is textual reformatting, not a conversion.
  const asOf = `${asOfText.replace(' ', 'T')}Z`;

  const account = accounts.find((a) => a.id === accountId);
  const range = ranges.find((r) => r.accountId === accountId);
  if (!account || !range) {
    throw new Error(`No such account: ${accountId}`);
  }

  const weeks = weekListFrom(range.earliestFullWeek, range.defaultWeek);
  const evalIndex = weeks.indexOf(weekStart);
  if (evalIndex === -1) {
    throw new Error(`${weekStart} is not an evaluable week for account ${accountId}`);
  }

  const locationRows = allLocationRows.filter((r) => r.accountId === accountId);
  const locationNames = [...new Set(locationRows.map((r) => r.location))].sort();
  const locationCount = locationNames.length;

  const seriesFor = (location: string | null): number[] =>
    weeks.map((week) => {
      if (location === null) {
        return locationRows
          .filter((r) => r.weekStart === week)
          .reduce((sum, r) => sum + r[column], 0);
      }
      const row = locationRows.find((r) => r.location === location && r.weekStart === week);
      return row ? row[column] : 0;
    });

  const accountHasAnyEvent = locationCount > 0;
  const accountResult = evaluateWindow(
    seriesFor(null),
    evalIndex,
    ACCOUNT_WINDOW_WEEKS,
    ACCOUNT_K,
    accountHasAnyEvent,
  );
  const verdict: VerdictResponse = { state: accountResult.state };
  if (accountResult.state !== 'not_enough_history') {
    verdict.count = accountResult.count!;
    verdict.typical = Math.round(accountResult.typical! * 10) / 10;
    verdict.usualRange = usualRange(accountResult.typical!, ACCOUNT_WINDOW_WEEKS, ACCOUNT_K);
    if (accountResult.state === 'flagged_up' || accountResult.state === 'flagged_down') {
      verdict.changePct = changePctFor(accountResult.count!, accountResult.typical!);
    }
  }

  const response: WeeklyCheckResponse = {
    asOf,
    week: { start: weekStart, end: addDays(weekStart, 6), isLatest: weekStart === range.defaultWeek },
    weeks,
    account: { id: account.id, name: account.name, locationCount },
    verdict,
  };

  if (locationCount >= MIN_LOCATIONS_TO_RENDER) {
    const flagged: LocationFlag[] = [];
    const notEnoughHistory: string[] = [];
    let quietCount = 0;

    for (const location of locationNames) {
      const result = evaluateWindow(seriesFor(location), evalIndex, LOCATION_WINDOW_WEEKS, locationCount);
      if (result.state === 'not_enough_history') {
        notEnoughHistory.push(location);
      } else if (result.state === 'quiet') {
        quietCount += 1;
      } else {
        flagged.push({
          location,
          state: result.state,
          count: result.count!,
          usualRange: usualRange(result.typical!, LOCATION_WINDOW_WEEKS, locationCount),
        });
      }
    }

    response.locations = {
      window: { start: addDays(weekStart, -21), end: addDays(weekStart, 6) },
      flagged,
      notEnoughHistory,
      quietCount,
    };
  }

  return response;
}
