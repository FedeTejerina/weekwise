import type { Pool } from 'pg';
import {
  getAccounts,
  getAccountWeekRanges,
  getAsOf,
  getInProgressCounts,
  getWeeklyLocationCounts,
  type AccountSummary,
  type AccountWeekRange,
  type InProgressCounts,
  type WeeklyLocationCounts,
} from './db/aggregation.js';
import { evaluateWindow, usualRange, type GateResult, type GateState } from './gate.js';

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

export interface InProgress {
  weekStart: string;
  daysIn: number;
  count: number;
}

export interface WeeklyCheckResponse {
  asOf: string;
  week: { start: string; end: string; isLatest: boolean };
  /** D18: the still-elapsing current week, as a plain fact — never compared, never baselined,
   * never part of a window. `null` only when the as-of moment falls exactly on a week boundary. */
  inProgress: InProgress | null;
  weeks: string[];
  account: { id: number; name: string; locationCount: number };
  verdict: VerdictResponse;
  locations?: LocationsResponse;
}

/** One location's raw gate result — before D16 decides whether it's ever shown. */
export interface LocationEvaluation {
  location: string;
  result: GateResult;
}

/**
 * The shared computation behind `weeklyCheck()`: the account verdict, plus every location's
 * gate result, *unsuppressed* — D16 (whether a `locations` section is shown at all) is a
 * response-shaping decision `weeklyCheck()` makes on top of this, not something baked in here.
 * T15's regression anchor needs exactly this: the gate's real behaviour on every location,
 * including the single-site ones D16 hides, so the suppression is a tested fact rather than an
 * accident (log I7/T15).
 */
export interface AccountWeekEvaluation {
  asOf: string;
  weeks: string[];
  evalIndex: number;
  account: { id: number; name: string };
  locationCount: number;
  weekStart: string;
  isLatest: boolean;
  accountResult: GateResult;
  locationEvaluations: LocationEvaluation[];
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekListFrom(earliestFullWeek: string, defaultWeek: string): string[] {
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

/**
 * Pure: the account verdict, from the gate's own result alone — no dependency on `inProgress`
 * or anything else, which is exactly what T9's deep-equal test checks by calling this same
 * function against a run where `inProgress` was never computed at all.
 */
export function buildVerdict(accountResult: GateResult): VerdictResponse {
  const verdict: VerdictResponse = { state: accountResult.state };
  if (accountResult.state !== 'not_enough_history') {
    verdict.count = accountResult.count!;
    verdict.typical = Math.round(accountResult.typical! * 10) / 10;
    verdict.usualRange = usualRange(accountResult.typical!, ACCOUNT_WINDOW_WEEKS, ACCOUNT_K);
    if (accountResult.state === 'flagged_up' || accountResult.state === 'flagged_down') {
      verdict.changePct = changePctFor(accountResult.count!, accountResult.typical!);
    }
  }
  return verdict;
}

/**
 * Everything `evaluateAccountWeek` needs from the database, fetched once. Separated out so a
 * caller evaluating many (account, type, week) combinations — T15's regression anchor, chiefly
 * — pays for the round trip once instead of once per combination, while still going through
 * the exact same evaluation code `weeklyCheck()` uses (log I19/CLAUDE.md rule 4: two
 * implementations of the same computation is exactly what drifts).
 */
export interface WeeklyCheckData {
  asOf: string;
  accounts: AccountSummary[];
  ranges: AccountWeekRange[];
  allLocationRows: WeeklyLocationCounts[];
  inProgressRows: InProgressCounts[];
}

export async function fetchWeeklyCheckData(pool: Pool): Promise<WeeklyCheckData> {
  const [asOfText, accounts, ranges, allLocationRows, inProgressRows] = await Promise.all([
    getAsOf(pool),
    getAccounts(pool),
    getAccountWeekRanges(pool),
    getWeeklyLocationCounts(pool),
    getInProgressCounts(pool),
  ]);
  // getAsOf's `::text` cast avoids pg's Date parsing but leaves a space, not the `T`/`Z` PLAN.md
  // §6 publishes; occurred_at is already UTC, so this is textual reformatting, not a conversion.
  const asOf = `${asOfText.replace(' ', 'T')}Z`;
  return { asOf, accounts, ranges, allLocationRows, inProgressRows };
}

/** Every distinct location `getWeeklyLocationCounts` ever recorded for this account, sorted.
 * Shared by `evaluateAccountWeekFromData` and the `/api/accounts` handler so "how many
 * locations does this account have" is computed in exactly one place. */
export function locationNamesFor(data: WeeklyCheckData, accountId: number): string[] {
  return [...new Set(data.allLocationRows.filter((r) => r.accountId === accountId).map((r) => r.location))].sort();
}

/**
 * D18, computed independently of `evaluateAccountWeekFromData`: it reads from a completely
 * separate query (`getInProgressCounts`) that never enters any account or location series, any
 * baseline, or any window — a test asserts the account verdict is unchanged whether this is
 * called or not (T9).
 */
export function inProgressFor(
  data: WeeklyCheckData,
  accountId: number,
  eventType: EventType,
): InProgress | null {
  const column = COLUMN_BY_EVENT_TYPE[eventType];
  const row = data.inProgressRows.find((r) => r.accountId === accountId);
  if (!row || row.isBoundary) {
    return null;
  }
  return { weekStart: row.weekStart, daysIn: row.daysIn, count: row[column] };
}

export function evaluateAccountWeekFromData(
  data: WeeklyCheckData,
  accountId: number,
  eventType: EventType,
  weekStart: string,
): AccountWeekEvaluation {
  const column = COLUMN_BY_EVENT_TYPE[eventType];
  const { asOf, accounts, ranges, allLocationRows } = data;

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
  const locationNames = locationNamesFor(data, accountId);
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

  const locationEvaluations: LocationEvaluation[] = locationNames.map((location) => ({
    location,
    result: evaluateWindow(seriesFor(location), evalIndex, LOCATION_WINDOW_WEEKS, locationCount),
  }));

  return {
    asOf,
    weeks,
    evalIndex,
    account: { id: account.id, name: account.name },
    locationCount,
    weekStart,
    isLatest: weekStart === range.defaultWeek,
    accountResult,
    locationEvaluations,
  };
}

export async function weeklyCheck(
  pool: Pool,
  accountId: number,
  eventType: EventType,
  weekStart: string,
): Promise<WeeklyCheckResponse> {
  const data = await fetchWeeklyCheckData(pool);
  const evaluation = evaluateAccountWeekFromData(data, accountId, eventType, weekStart);
  const { locationCount } = evaluation;
  const verdict = buildVerdict(evaluation.accountResult);

  const response: WeeklyCheckResponse = {
    asOf: evaluation.asOf,
    week: { start: weekStart, end: addDays(weekStart, 6), isLatest: evaluation.isLatest },
    inProgress: inProgressFor(data, accountId, eventType),
    weeks: evaluation.weeks,
    account: { ...evaluation.account, locationCount },
    verdict,
  };

  if (locationCount >= MIN_LOCATIONS_TO_RENDER) {
    const flagged: LocationFlag[] = [];
    const notEnoughHistory: string[] = [];
    let quietCount = 0;

    for (const { location, result } of evaluation.locationEvaluations) {
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
