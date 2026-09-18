import cdfLib from '@stdlib/stats-base-dists-negative-binomial-cdf';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classify, evaluateWindow, trimmedMean, usualRange } from '../../src/gate.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('trimmedMean', () => {
  it('drops exactly one highest and one lowest week, averaging the remaining 10', () => {
    const weeks = [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 5, 20];
    expect(trimmedMean(weeks)).toBe(10);
  });

  it("ties don't drop the same week twice — they drop by sort position, not by value", () => {
    // Two weeks tie for lowest (2), one week is highest (8): dropping "every week equal to the
    // min/max" would remove three weeks and leave 9; the spec drops exactly one of each.
    const weeks = [2, 2, 5, 5, 5, 5, 5, 5, 5, 5, 5, 8];
    // sorted.slice(1, -1) drops one 2 and the 8, leaving one 2 and nine 5s: (2 + 9*5) / 10.
    expect(trimmedMean(weeks)).toBeCloseTo(4.7, 10);
  });

  it('rejects anything other than exactly 12 weeks', () => {
    expect(() => trimmedMean(Array(11).fill(1))).toThrow();
    expect(() => trimmedMean(Array(13).fill(1))).toThrow();
  });
});

describe('minimum history (D8): 16 full weeks for a location, 13 for the account', () => {
  it('a location with 15 weeks of history is not_enough_history; 16 is evaluated', () => {
    // The seed itself can never produce this state (log I3: no location has fewer than 16
    // full weeks at any week the gate evaluates) — it exists only as a constructed fixture.
    const fifteenWeeks = Array(15).fill(4);
    expect(evaluateWindow(fifteenWeeks, fifteenWeeks.length - 1, 4, 9).state).toBe('not_enough_history');

    const sixteenWeeks = Array(16).fill(4);
    const result = evaluateWindow(sixteenWeeks, sixteenWeeks.length - 1, 4, 9);
    expect(result.state).not.toBe('not_enough_history');
  });

  it('hasAnyEvent=false is not_enough_history even with a full calendar history of zeros (account 20)', () => {
    // Plenty of calendar weeks, but every one of them is zero: the raw formula floors m at
    // 0.1 and calls x=0 against it "quiet" forever, which is wrong for an account that has
    // never recorded a single event. Caught against the real seed while building T7 (log I20).
    const allZero = Array(20).fill(0);
    const withoutFlag = evaluateWindow(allZero, allZero.length - 1, 1, 1);
    expect(withoutFlag.state).toBe('quiet');

    const withFlag = evaluateWindow(allZero, allZero.length - 1, 1, 1, false);
    expect(withFlag.state).toBe('not_enough_history');
    expect(withFlag.typical).toBeNull();
    expect(withFlag.count).toBeNull();
  });

  it('an account with 12 weeks of history is not_enough_history; 13 is evaluated', () => {
    const twelveWeeks = Array(12).fill(10);
    expect(evaluateWindow(twelveWeeks, twelveWeeks.length - 1, 1, 1).state).toBe('not_enough_history');

    const thirteenWeeks = Array(13).fill(10);
    const result = evaluateWindow(thirteenWeeks, thirteenWeeks.length - 1, 1, 1);
    expect(result.state).not.toBe('not_enough_history');
  });
});

describe('the floor: m is never allowed to reach 0', () => {
  it('an all-zero baseline floors m at 0.1, giving r=1, with no NaN and no throw', () => {
    const series = Array(13).fill(0);
    let result;
    expect(() => {
      result = evaluateWindow(series, series.length - 1, 1, 1);
    }).not.toThrow();
    expect(result!.typical).toBe(0.1);
    // r = 10*m (classify's own formula, PLAN.md §4) — asserted directly, not just implied by
    // the floored typical value.
    expect(10 * result!.typical!).toBe(1);
    expect(Number.isNaN(result!.count)).toBe(false);
    expect(result!.state).not.toBe(undefined);
  });
});

describe('usualRange is self-consistent with the gate it describes', () => {
  // Brute-forced against `classify` directly, not against usualRange's own formula — this is
  // exactly the clause that would have caught §4's original off-by-one (log I7): coding that
  // sentence literally gives one-too-low an upper bound everywhere.
  const cases: Array<[m: number, w: number, k: number]> = [
    [43.9, 1, 1],
    [11.1, 1, 1],
    [1.4, 4, 15],
    [0.1, 4, 9],
    [20.6, 4, 4],
    [2.0, 4, 15],
  ];

  it.each(cases)('every count inside [lo, hi] is quiet; both neighbours just outside are flagged (m=%s, w=%s, k=%s)', (m, w, k) => {
    const [lo, hi] = usualRange(m, w, k);
    for (let x = lo; x <= hi; x += 1) {
      expect(classify(x, m, w, k)).toBe('quiet');
    }
    if (lo > 0) {
      expect(classify(lo - 1, m, w, k)).toBe('flagged_down');
    }
    expect(classify(hi + 1, m, w, k)).toBe('flagged_up');
  });
});

describe('alpha halves per side and divides by k (D4)', () => {
  it('one constructed case flags at k=1 and is quiet at k=15', () => {
    const m = 10;
    const w = 1;
    const [, hiAtK1] = usualRange(m, w, 1);
    const x = hiAtK1 + 1;
    expect(classify(x, m, w, 1)).toBe('flagged_up');
    expect(classify(x, m, w, 15)).toBe('quiet');
  });
});

describe('agreement with the committed scipy fixture (T5b)', () => {
  const fixturePath = resolve(__dirname, '../../../scripts/nbinom-fixture.json');
  const fixture: Array<{ r: number; p: number; x: number; cdf: number }> = JSON.parse(
    readFileSync(fixturePath, 'utf8'),
  );

  it('has at least one non-integer r case', () => {
    expect(fixture.some((c) => c.r !== Math.trunc(c.r))).toBe(true);
  });

  it('max relative error against @stdlib is under 1e-10 across every row', () => {
    // E7 measured @stdlib's actual error at 3.2e-14, so this threshold is a safety margin,
    // not a target.
    let maxRelError = 0;
    for (const c of fixture) {
      const actual = cdfLib(c.x, c.r, c.p);
      const denominator = Math.max(Math.abs(c.cdf), 1e-300);
      const relError = Math.abs(actual - c.cdf) / denominator;
      maxRelError = Math.max(maxRelError, relError);
    }
    expect(maxRelError).toBeLessThan(1e-10);
  });
});
