import cdf from '@stdlib/stats-base-dists-negative-binomial-cdf';

/**
 * The significance gate (D13 / PLAN.md §4): a negative-binomial predictive test over a
 * trimmed-mean baseline. Pure functions, no database — every input here is a plain array of
 * weekly counts in chronological order; `server/src/db/aggregation.ts` supplies those arrays.
 */

export type GateState = 'flagged_up' | 'flagged_down' | 'quiet' | 'not_enough_history';

export interface GateResult {
  state: GateState;
  /** The trimmed-mean baseline (D8), or `null` when there wasn't enough history to compute one. */
  typical: number | null;
  /** The observed w-week window total, or `null` when there wasn't enough history to evaluate. */
  count: number | null;
}

/** Full weeks of baseline required before a window (D8): drop the highest and lowest of 12. */
export const BASELINE_WEEKS = 12;

/** `m` is floored here so `r = 10*m` stays positive (PLAN.md §4). */
const FLOOR_M = 0.1;

/**
 * The trimmed mean of exactly 12 full weeks: drop one highest and one lowest — by sort
 * position, not by value, so ties never drop the same week twice — and average the remaining
 * 10 (D8). Floored at 0.1.
 */
export function trimmedMean(baselineWeeks: readonly number[]): number {
  if (baselineWeeks.length !== BASELINE_WEEKS) {
    throw new Error(`trimmedMean expects exactly ${BASELINE_WEEKS} weeks, got ${baselineWeeks.length}`);
  }
  const sorted = [...baselineWeeks].sort((a, b) => a - b);
  const trimmed = sorted.slice(1, -1);
  const mean = trimmed.reduce((sum, n) => sum + n, 0) / trimmed.length;
  return Math.max(mean, FLOOR_M);
}

/**
 * The gate itself, given an observed window total `x` against a baseline `m` (D13): `DOWN` if
 * `CDF(x) < α`, `UP` if `1 − CDF(x−1) < α`, otherwise quiet. `w` is the window length in weeks
 * (1 for the account verdict, 4 for a location) and `k` is the number of things `α` is split
 * across (D4) — the location count for the location gate, 1 for the account verdict (D10).
 */
export function classify(x: number, m: number, w: number, k: number): 'flagged_up' | 'flagged_down' | 'quiet' {
  const r = 10 * m;
  const p = 10 / (10 + w);
  const alpha = 0.05 / (2 * k);
  if (cdf(x, r, p) < alpha) {
    return 'flagged_down';
  }
  if (1 - cdf(x - 1, r, p) < alpha) {
    return 'flagged_up';
  }
  return 'quiet';
}

/**
 * Evaluates a `w`-week window ending at (and including) `evalIndex` in `series` — a
 * chronologically-ordered array of weekly counts. Returns `not_enough_history` when either:
 * the 12 baseline weeks immediately before the window don't exist yet (minimum history is
 * `12 + w` full weeks — 16 for a location, 13 for the account verdict, D8); or `hasAnyEvent` is
 * false. That second case is for an account or location with zero events in its entire
 * history (account 20 in the seed): an all-zero series has plenty of *calendar* weeks, so the
 * calendar check alone would call it "quiet" forever — a near-zero floored baseline against a
 * zero observed count never crosses either threshold. `hasAnyEvent` defaults to `true` because
 * every location this gate is ever called for already has at least one event, by construction
 * (T5b's harness needed the same guard, for the same reason — log I19/T5b's verdict-flags
 * anchor excludes account 20 explicitly rather than trusting the raw formula to exclude it).
 */
export function evaluateWindow(
  series: readonly number[],
  evalIndex: number,
  w: number,
  k: number,
  hasAnyEvent = true,
): GateResult {
  const windowStart = evalIndex - w + 1;
  const baselineStart = windowStart - BASELINE_WEEKS;
  if (!hasAnyEvent || baselineStart < 0) {
    return { state: 'not_enough_history', typical: null, count: null };
  }
  const baseline = series.slice(baselineStart, windowStart);
  const m = trimmedMean(baseline);
  const x = series.slice(windowStart, evalIndex + 1).reduce((sum, n) => sum + n, 0);
  return { state: classify(x, m, w, k), typical: m, count: x };
}

/**
 * The usual range shown alongside a verdict (D16): `[lo, hi]`, the counts the gate leaves
 * quiet. `lo` is the smallest count with `CDF(lo) ≥ α`; `hi` is the largest count with
 * `1 − CDF(hi − 1) ≥ α` — stated operationally per the §4 erratum (log I7), since the original
 * sentence was off by one against the gate directly above it.
 */
export function usualRange(m: number, w: number, k: number): [lo: number, hi: number] {
  let lo = 0;
  while (classify(lo, m, w, k) === 'flagged_down') {
    lo += 1;
  }
  let hi = lo;
  while (classify(hi + 1, m, w, k) === 'quiet') {
    hi += 1;
  }
  return [lo, hi];
}
