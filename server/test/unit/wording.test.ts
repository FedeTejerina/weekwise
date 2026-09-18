import { describe, expect, it } from 'vitest';
import {
  explain,
  formatInProgressRange,
  inProgressLine,
  locationFlaggedSentence,
  locationsNotEnoughHistoryLine,
  locationsQuietLine,
  verdictSentence,
  type Parts,
} from '../../src/wording.js';

function bolded(parts: Parts): string[] {
  return parts.emphasis.map(([start, end]) => parts.text.slice(start, end));
}

describe('verdictSentence — the six account states (§7), verbatim', () => {
  it('account 1, calls, 2026-07-20 — quiet, 34, usual 20–42, no percentage', () => {
    const parts = verdictSentence({
      state: 'quiet',
      count: 34,
      typical: 30.4,
      usualRange: [20, 42],
      weekStart: '2026-07-20',
      weekEnd: '2026-07-26',
      eventType: 'call_received',
    });
    expect(parts.text).toBe(
      "34 calls in the week of 20–26 July. That's normal for you — your usual week is 20 to 42 calls.",
    );
    expect(bolded(parts)).toEqual(['34 calls', 'normal for you', '20 to 42 calls']);
    expect(parts.text).not.toContain('%');
  });

  it('account 6, calls, 2026-06-01 — up, 528, usual 31–58, "about 12×"', () => {
    const parts = verdictSentence({
      state: 'flagged_up',
      count: 528,
      typical: 43.9,
      usualRange: [31, 58],
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      eventType: 'call_received',
    });
    expect(parts.text).toBe(
      '528 calls in the week of 1–7 June, against a usual 31 to 58. ' +
        "That's about 12× your typical week.",
    );
    expect(bolded(parts)).toEqual(['528 calls', '31 to 58', '12×']);
  });

  it('account 7, calls, 2026-07-13 — down, 3, usual 5–18, "about 73% below"', () => {
    const parts = verdictSentence({
      state: 'flagged_down',
      count: 3,
      typical: 11.1,
      usualRange: [5, 18],
      weekStart: '2026-07-13',
      weekEnd: '2026-07-19',
      eventType: 'call_received',
    });
    expect(parts.text).toBe(
      '3 calls in the week of 13–19 July, against a usual 5 to 18. ' +
        "That's about 73% below your typical week.",
    );
    expect(bolded(parts)).toEqual(['3 calls', '5 to 18', '73%']);
  });

  it('account 12, calls, 2026-06-29 — up, 45, usual 20–43, "about 45% above" (under-2x case)', () => {
    const parts = verdictSentence({
      state: 'flagged_up',
      count: 45,
      typical: 31,
      usualRange: [20, 43],
      weekStart: '2026-06-29',
      weekEnd: '2026-07-05',
      eventType: 'call_received',
    });
    expect(parts.text).toBe(
      '45 calls in the week of 29 June – 5 July, against a usual 20 to 43. ' +
        "That's about 45% above your typical week.",
    );
    expect(bolded(parts)).toEqual(['45 calls', '20 to 43', '45%']);
  });

  it('account 15, leads, 2026-05-25 — down, 0, usual 1–9, "no leads at all", no percentage', () => {
    const parts = verdictSentence({
      state: 'flagged_down',
      count: 0,
      typical: 4.4,
      usualRange: [1, 9],
      weekStart: '2026-05-25',
      weekEnd: '2026-05-31',
      eventType: 'lead_created',
    });
    expect(parts.text).toBe('No leads at all in the week of 25–31 May, against a usual 1 to 9.');
    expect(bolded(parts)).toEqual(['No leads at all', '1 to 9']);
    expect(parts.text).not.toContain('%');
  });

  it('not enough history — constructed fixture (the seed cannot produce this, log I3)', () => {
    const parts = verdictSentence({
      state: 'not_enough_history',
      weekStart: '2026-07-20',
      weekEnd: '2026-07-26',
      eventType: 'call_received',
      weeksHave: 9,
      weeksNeeded: 13,
    });
    expect(parts.text).toBe('Not enough history yet. Judging a normal week takes 13 weeks of data; you have 9.');
    expect(parts.emphasis).toEqual([]);
  });

  it('not enough history — the short form, when weeksHave/weeksNeeded are absent (account 20\'s real case)', () => {
    const parts = verdictSentence({
      state: 'not_enough_history',
      weekStart: '2026-07-20',
      weekEnd: '2026-07-26',
      eventType: 'call_received',
    });
    expect(parts.text).toBe('Not enough history yet.');
    expect(parts.emphasis).toEqual([]);
  });
});

describe('locationFlaggedSentence — account 6, Site N, calls, 4 weeks to 2026-06-07', () => {
  it('up, 40, usual 2–24', () => {
    const parts = locationFlaggedSentence({
      location: 'Site N',
      count: 40,
      usualRange: [2, 24],
      eventType: 'call_received',
      windowEnd: '2026-06-07',
    });
    expect(parts.text).toBe('Site N — 40 calls over the 4 weeks to 7 June, against a usual 2 to 24.');
    expect(bolded(parts)).toEqual(['Site N — 40 calls', '2 to 24']);
  });
});

describe('locationsQuietLine', () => {
  it('15 locations, 4 weeks to 2026-06-07', () => {
    const parts = locationsQuietLine(15, '2026-06-07');
    expect(parts.text).toBe('Nothing unusual at any of your 15 locations over the 4 weeks to 7 June.');
    expect(parts.emphasis).toEqual([]);
  });
});

describe('locationsNotEnoughHistoryLine — constructed fixture (log I3)', () => {
  it('lists locations by name, joined in plain English', () => {
    expect(locationsNotEnoughHistoryLine(['Site P']).text).toBe('Not enough history yet for Site P.');
    expect(locationsNotEnoughHistoryLine(['Site A', 'Site B']).text).toBe(
      'Not enough history yet for Site A and Site B.',
    );
    expect(locationsNotEnoughHistoryLine(['Site A', 'Site B', 'Site C']).text).toBe(
      'Not enough history yet for Site A, Site B and Site C.',
    );
  });
});

describe('inProgressLine (D18/T9)', () => {
  it('account 6, calls, as-of Monday 2026-07-27 — "This week so far: 7 calls, 1 day in (Mon 27 July)."', () => {
    const parts = inProgressLine(
      { weekStart: '2026-07-27', daysIn: 1, count: 7 },
      '2026-07-27',
      'call_received',
    );
    expect(parts!.text).toBe('This week so far: 7 calls, 1 day in (Mon 27 July).');
    expect(bolded(parts!)).toEqual(['7 calls']);
  });

  it('accounts 2, 8, 20 — nothing yet — "This week so far: no calls yet, 1 day in (Mon 27 July)."', () => {
    const parts = inProgressLine(
      { weekStart: '2026-07-27', daysIn: 1, count: 0 },
      '2026-07-27',
      'call_received',
    );
    expect(parts!.text).toBe('This week so far: no calls yet, 1 day in (Mon 27 July).');
    expect(bolded(parts!)).toEqual(['no calls yet']);
  });

  it('null in, null out — the exact-boundary case', () => {
    expect(inProgressLine(null, '2026-07-27', 'call_received')).toBeNull();
  });

  it('a later weekday reads as a weekday range: "3 days in (Mon–Wed 29 July)"', () => {
    const parts = inProgressLine(
      { weekStart: '2026-07-27', daysIn: 3, count: 12 },
      '2026-07-29',
      'call_received',
    );
    expect(parts!.text).toBe('This week so far: 12 calls, 3 days in (Mon–Wed 29 July).');
  });
});

describe('formatInProgressRange', () => {
  it('matches PLAN.md §7\'s own illustrative Wednesday example', () => {
    expect(formatInProgressRange('2026-07-27', '2026-07-29')).toBe('(Mon–Wed 29 July)');
  });
});

describe('explain() — the §8 seam, same template, flattened to markdown', () => {
  it('reproduces the account-6 sentence as a plain markdown string', () => {
    const text = explain({
      state: 'flagged_up',
      count: 528,
      typical: 43.9,
      usualRange: [31, 58],
      weekStart: '2026-06-01',
      weekEnd: '2026-06-07',
      eventType: 'call_received',
    });
    expect(text).toBe(
      '**528 calls** in the week of 1–7 June, against a usual **31 to 58**. ' +
        "That's about **12×** your typical week.",
    );
  });
});
