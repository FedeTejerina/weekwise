import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App.js';
import type { AccountSummary, WeeklyCheckResponse } from '../src/api.js';

/**
 * T13 (droppable): the same behaviour T12's screenshots evidence once, made repeatable.
 * `fetch` is mocked per test with response shapes matching the real API exactly — the numbers
 * are the same measured ones T7/T15 already pin (account 6 calls 2026-06-01 -> 528, etc.), not
 * invented fixtures, so a real regression in the wiring shows up the same way it would live.
 */

// The dataset's own full week range (T4), reused verbatim so the week control has something
// real to populate from.
const FULL_WEEKS = [
  '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23', '2026-03-02', '2026-03-09', '2026-03-16',
  '2026-03-23', '2026-03-30', '2026-04-06', '2026-04-13', '2026-04-20', '2026-04-27', '2026-05-04',
  '2026-05-11', '2026-05-18', '2026-05-25', '2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22',
  '2026-06-29', '2026-07-06', '2026-07-13', '2026-07-20',
];

const AS_OF = '2026-07-27T22:20:34Z';

function mockFetch(accounts: AccountSummary[], weeklyCheck: WeeklyCheckResponse) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes('/api/accounts')) {
        return new Response(JSON.stringify(accounts), { status: 200 });
      }
      if (url.includes('/api/weekly-check')) {
        return new Response(JSON.stringify(weeklyCheck), { status: 200 });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
}

function setUrl(search: string) {
  window.history.pushState(null, '', `/${search}`);
}

beforeEach(() => {
  setUrl('');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the six account states (§7) render with no hand-written sentence', () => {
  it('quiet — account 1, calls, 2026-07-20 — no "%" anywhere on the page', async () => {
    setUrl('?account=1&type=call_received&week=2026-07-20');
    mockFetch(
      [{ id: 1, name: 'Summit Auto Group', timezone: 'America/Chicago', locationCount: 6 }],
      {
        asOf: AS_OF,
        week: { start: '2026-07-20', end: '2026-07-26', isLatest: true },
        inProgress: { weekStart: '2026-07-27', daysIn: 1, count: 3 },
        weeks: FULL_WEEKS,
        account: { id: 1, name: 'Summit Auto Group', locationCount: 6 },
        verdict: { state: 'quiet', count: 34, typical: 30.4, usualRange: [20, 42] },
        locations: {
          window: { start: '2026-06-29', end: '2026-07-26' },
          flagged: [],
          notEnoughHistory: [],
          quietCount: 6,
        },
      },
    );

    render(<App />);
    await screen.findByText(/34 calls/);
    screen.getByText(/normal for you/);
    screen.getByText(/Nothing unusual at any of your 6 locations/);
    expect(document.body.textContent).not.toContain('%');
  });

  it('flagged up, 2x or more — account 6, calls, 2026-06-01 — "12×", Site N listed', async () => {
    setUrl('?account=6&type=call_received&week=2026-06-01');
    mockFetch(
      [{ id: 6, name: 'Metro Collision Centers', timezone: 'America/New_York', locationCount: 15 }],
      {
        asOf: AS_OF,
        week: { start: '2026-06-01', end: '2026-06-07', isLatest: false },
        inProgress: { weekStart: '2026-07-27', daysIn: 1, count: 7 },
        weeks: FULL_WEEKS,
        account: { id: 6, name: 'Metro Collision Centers', locationCount: 15 },
        verdict: { state: 'flagged_up', count: 528, typical: 43.9, usualRange: [31, 58], changePct: 1103 },
        locations: {
          window: { start: '2026-05-11', end: '2026-06-07' },
          flagged: [{ location: 'Site N', state: 'flagged_up', count: 40, usualRange: [2, 24] }],
          notEnoughHistory: [],
          quietCount: 0,
        },
      },
    );

    render(<App />);
    await screen.findByText(/528 calls/);
    screen.getByText(/12×/);
    screen.getByText(/Site N/);
  });

  it('flagged down — account 7, calls, 2026-07-13 — "73%"', async () => {
    setUrl('?account=7&type=call_received&week=2026-07-13');
    mockFetch(
      [{ id: 7, name: 'Desert Springs Plumbing', timezone: 'America/Phoenix', locationCount: 2 }],
      {
        asOf: AS_OF,
        week: { start: '2026-07-13', end: '2026-07-19', isLatest: false },
        inProgress: null,
        weeks: FULL_WEEKS,
        account: { id: 7, name: 'Desert Springs Plumbing', locationCount: 2 },
        verdict: { state: 'flagged_down', count: 3, typical: 11.1, usualRange: [5, 18], changePct: -73 },
        locations: {
          window: { start: '2026-06-22', end: '2026-07-19' },
          flagged: [],
          notEnoughHistory: [],
          quietCount: 2,
        },
      },
    );

    render(<App />);
    await screen.findByText(/3 calls/);
    screen.getByText(/73%/);
    screen.getByText(/below/);
  });

  it('flagged up, under 2x — account 12, calls, 2026-06-29 — "45%"', async () => {
    setUrl('?account=12&type=call_received&week=2026-06-29');
    mockFetch(
      [{ id: 12, name: 'Redline Tire & Service', timezone: 'America/Los_Angeles', locationCount: 7 }],
      {
        asOf: AS_OF,
        week: { start: '2026-06-29', end: '2026-07-05', isLatest: false },
        inProgress: null,
        weeks: FULL_WEEKS,
        account: { id: 12, name: 'Redline Tire & Service', locationCount: 7 },
        verdict: { state: 'flagged_up', count: 45, typical: 31, usualRange: [20, 43], changePct: 45 },
        locations: {
          window: { start: '2026-06-08', end: '2026-07-05' },
          flagged: [],
          notEnoughHistory: [],
          quietCount: 7,
        },
      },
    );

    render(<App />);
    await screen.findByText(/45 calls/);
    screen.getByText(/45%/);
    screen.getByText(/above/);
  });

  it('flagged down to zero — account 15, leads, 2026-05-25 — "no leads at all", no "%"', async () => {
    setUrl('?account=15&type=lead_created&week=2026-05-25');
    mockFetch(
      [{ id: 15, name: 'Sierra Pest Solutions', timezone: 'America/Phoenix', locationCount: 3 }],
      {
        asOf: AS_OF,
        week: { start: '2026-05-25', end: '2026-05-31', isLatest: false },
        inProgress: null,
        weeks: FULL_WEEKS,
        account: { id: 15, name: 'Sierra Pest Solutions', locationCount: 3 },
        verdict: { state: 'flagged_down', count: 0, typical: 4.4, usualRange: [1, 9], changePct: -100 },
        locations: {
          window: { start: '2026-05-04', end: '2026-05-31' },
          flagged: [],
          notEnoughHistory: [],
          quietCount: 3,
        },
      },
    );

    render(<App />);
    await screen.findByText(/No leads at all/);
    expect(document.body.textContent).not.toContain('%');
  });

  it('not enough history — account 20 — renders cleanly, no crash', async () => {
    setUrl('?account=20&type=call_received&week=2026-07-20');
    mockFetch(
      [{ id: 20, name: 'Quiet Harbor Spa', timezone: 'America/Los_Angeles', locationCount: 0 }],
      {
        asOf: AS_OF,
        week: { start: '2026-07-20', end: '2026-07-26', isLatest: true },
        inProgress: { weekStart: '2026-07-27', daysIn: 1, count: 0 },
        weeks: FULL_WEEKS,
        account: { id: 20, name: 'Quiet Harbor Spa', locationCount: 0 },
        verdict: { state: 'not_enough_history' },
        // No `locations` key — account 20 has zero locations.
      },
    );

    render(<App />);
    await screen.findByText(/Not enough history yet/);
  });
});

describe('locations quiet line (R1 #1)', () => {
  it('is not shown when every location is not-enough-history — no "0 locations"', async () => {
    setUrl('?account=6&type=call_received&week=2026-02-02');
    mockFetch(
      [{ id: 6, name: 'Metro Collision Centers', timezone: 'America/New_York', locationCount: 15 }],
      {
        asOf: AS_OF,
        week: { start: '2026-02-02', end: '2026-02-08', isLatest: false },
        inProgress: null,
        weeks: FULL_WEEKS,
        account: { id: 6, name: 'Metro Collision Centers', locationCount: 15 },
        verdict: { state: 'not_enough_history', weeksHave: 1, weeksNeeded: 13 },
        locations: {
          window: { start: '2026-01-12', end: '2026-02-08' },
          flagged: [],
          notEnoughHistory: Array.from({ length: 15 }, (_, i) => `Site ${String.fromCharCode(65 + i)}`),
          quietCount: 0,
        },
      },
    );

    render(<App />);
    await screen.findByText(/Not enough history yet for Site A/);
    expect(screen.queryByText(/Nothing unusual/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/0 locations/);
  });
});

describe('week selector: needs-more-history labels (follow-up to I34)', () => {
  it('the first 12 weeks (evalIndex < 12) are suffixed; the rest render as the bare date', async () => {
    setUrl('?account=1&type=call_received&week=2026-07-20');
    mockFetch(
      [{ id: 1, name: 'Summit Auto Group', timezone: 'America/Chicago', locationCount: 6 }],
      {
        asOf: AS_OF,
        week: { start: '2026-07-20', end: '2026-07-26', isLatest: true },
        inProgress: { weekStart: '2026-07-27', daysIn: 1, count: 3 },
        weeks: FULL_WEEKS,
        account: { id: 1, name: 'Summit Auto Group', locationCount: 6 },
        verdict: { state: 'quiet', count: 34, typical: 30.4, usualRange: [20, 42] },
        locations: {
          window: { start: '2026-06-29', end: '2026-07-26' },
          flagged: [],
          notEnoughHistory: [],
          quietCount: 6,
        },
      },
    );

    render(<App />);
    await screen.findByText(/34 calls/);

    // FULL_WEEKS[0..11] — evalIndex < BASELINE_WEEKS — carry the suffix.
    screen.getByRole('option', { name: '2026-02-02 — needs more history' });
    screen.getByRole('option', { name: '2026-04-20 — needs more history' });

    // FULL_WEEKS[12] onward — evalIndex >= BASELINE_WEEKS — the bare date, no suffix. Exact
    // matching (the library default) is itself the negative assertion: it fails if either
    // option's accessible name carries the suffix.
    screen.getByRole('option', { name: '2026-04-27' });
    screen.getByRole('option', { name: '2026-07-20' });

    screen.getByText('Verdicts need 13 weeks of history; earlier weeks show why.');
  });
});

describe('single-site suppression (D16)', () => {
  it('account 19 — no location section rendered at all, even though `locations` is simply absent from the API response', async () => {
    setUrl('?account=19&type=lead_created&week=2026-05-18');
    mockFetch(
      [{ id: 19, name: 'Riverbend Chiropractic', timezone: 'America/New_York', locationCount: 1 }],
      {
        asOf: AS_OF,
        week: { start: '2026-05-18', end: '2026-05-24', isLatest: false },
        inProgress: null,
        weeks: FULL_WEEKS,
        account: { id: 19, name: 'Riverbend Chiropractic', locationCount: 1 },
        verdict: { state: 'quiet', count: 4, typical: 2.8, usualRange: [0, 5] },
        // No `locations` key, matching the real API for single-site accounts (D16).
      },
    );

    const { container } = render(<App />);
    await screen.findByText(/4 leads/);
    expect(container.querySelector('.locations')).toBeNull();
  });
});
