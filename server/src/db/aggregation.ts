import type { Pool } from 'pg';

export interface AccountSummary {
  id: number;
  name: string;
  timezone: string;
}

export interface AccountWeekRange {
  accountId: number;
  /** First local Monday for which the whole week is inside the data window. */
  earliestFullWeek: string;
  /** Latest completed local week as of the dataset's own last event (D7). */
  defaultWeek: string;
}

export interface WeeklyLocationCounts {
  accountId: number;
  location: string;
  weekStart: string;
  calls: number;
  leads: number;
  appointments: number;
}

export interface InProgressCounts {
  accountId: number;
  /** The local Monday of the account's current, still-elapsing week. */
  weekStart: string;
  /** Day number within that week: 1 on Monday. */
  daysIn: number;
  /** True only when the as-of moment falls exactly on the week's Monday-00:00 boundary (D18) —
   * zero time has elapsed, so there is no in-progress week to report. */
  isBoundary: boolean;
  calls: number;
  leads: number;
  appointments: number;
}

/** Every account, id order — the accounts table itself, nothing derived. */
export async function getAccounts(pool: Pool): Promise<AccountSummary[]> {
  const { rows } = await pool.query<AccountSummary>(
    `SELECT id, name, timezone FROM accounts ORDER BY id`,
  );
  return rows;
}

/** The dataset's own "now" (D7): the latest `occurred_at` across every event, as UTC text. */
export async function getAsOf(pool: Pool): Promise<string> {
  const { rows } = await pool.query<{ asOf: string }>(
    `SELECT MAX(occurred_at)::text AS "asOf" FROM activity_events`,
  );
  // An aggregate with no GROUP BY always returns exactly one row.
  return rows[0]!.asOf;
}

/**
 * Per account, in that account's own timezone: the first local week fully inside the data
 * window (no data is missing from before it), and the latest local week that had fully
 * elapsed as of the dataset's own as-of moment. Both derived from MIN/MAX(occurred_at) —
 * nothing here is a hard-coded date, so it holds even if the seed changes.
 */
export async function getAccountWeekRanges(pool: Pool): Promise<AccountWeekRange[]> {
  const { rows } = await pool.query<AccountWeekRange>(`
    WITH bounds AS (
      SELECT MIN(occurred_at) AS min_at, MAX(occurred_at) AS max_at FROM activity_events
    ),
    local_bounds AS (
      SELECT
        a.id AS account_id,
        (b.min_at AT TIME ZONE 'UTC' AT TIME ZONE a.timezone) AS local_min,
        (b.max_at AT TIME ZONE 'UTC' AT TIME ZONE a.timezone) AS local_max
      FROM accounts a CROSS JOIN bounds b
    )
    SELECT
      account_id AS "accountId",
      (CASE
        WHEN local_min = date_trunc('week', local_min) THEN date_trunc('week', local_min)
        ELSE date_trunc('week', local_min) + interval '7 days'
      END)::date::text AS "earliestFullWeek",
      (date_trunc('week', local_max) - interval '7 days')::date::text AS "defaultWeek"
    FROM local_bounds
    ORDER BY account_id;
  `);
  return rows;
}

/**
 * One row per (account, location, full local week), zero-filled, with duplicate events
 * (identical on every column but `id`) collapsed before counting. Each account's week series
 * spans its own earliest full week through its own default week — see `getAccountWeekRanges`.
 */
export async function getWeeklyLocationCounts(pool: Pool): Promise<WeeklyLocationCounts[]> {
  const { rows } = await pool.query<WeeklyLocationCounts>(`
    WITH dedup AS (
      SELECT DISTINCT account_id, location, event_type, occurred_at, duration_seconds, outcome
      FROM activity_events
    ),
    bounds AS (
      SELECT MIN(occurred_at) AS min_at, MAX(occurred_at) AS max_at FROM activity_events
    ),
    account_ranges AS (
      SELECT
        a.id AS account_id,
        a.timezone,
        (b.min_at AT TIME ZONE 'UTC' AT TIME ZONE a.timezone) AS local_min,
        (b.max_at AT TIME ZONE 'UTC' AT TIME ZONE a.timezone) AS local_max
      FROM accounts a CROSS JOIN bounds b
    ),
    account_week_bounds AS (
      SELECT
        account_id,
        timezone,
        (CASE
          WHEN local_min = date_trunc('week', local_min) THEN date_trunc('week', local_min)
          ELSE date_trunc('week', local_min) + interval '7 days'
        END)::date AS earliest_full_week,
        (date_trunc('week', local_max) - interval '7 days')::date AS default_week
      FROM account_ranges
    ),
    weeks AS (
      SELECT account_id, generate_series(earliest_full_week, default_week, interval '7 days')::date AS week_start
      FROM account_week_bounds
    ),
    bucketed AS (
      SELECT
        d.account_id,
        d.location,
        d.event_type,
        date_trunc('week', (d.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE a.timezone)::date AS week_start
      FROM dedup d
      JOIN accounts a ON a.id = d.account_id
    ),
    locations AS (
      SELECT DISTINCT account_id, location FROM dedup
    )
    SELECT
      l.account_id AS "accountId",
      l.location,
      w.week_start::text AS "weekStart",
      COUNT(*) FILTER (WHERE b.event_type = 'call_received')::int AS calls,
      COUNT(*) FILTER (WHERE b.event_type = 'lead_created')::int AS leads,
      COUNT(*) FILTER (WHERE b.event_type = 'appointment_set')::int AS appointments
    FROM locations l
    JOIN weeks w ON w.account_id = l.account_id
    LEFT JOIN bucketed b
      ON b.account_id = l.account_id AND b.location = l.location AND b.week_start = w.week_start
    GROUP BY l.account_id, l.location, w.week_start
    ORDER BY l.account_id, l.location, w.week_start;
  `);
  return rows;
}

/**
 * The in-progress week (D18): per account, the selected-event-type counts from the start of
 * the account's current local week through the as-of moment, deduplicated like everything
 * else. Never baselined, never zero-filled against a series — this is a plain fact about
 * "right now", not a comparison.
 */
export async function getInProgressCounts(pool: Pool): Promise<InProgressCounts[]> {
  const { rows } = await pool.query<InProgressCounts>(`
    WITH dedup AS (
      SELECT DISTINCT account_id, location, event_type, occurred_at, duration_seconds, outcome
      FROM activity_events
    ),
    bounds AS (
      SELECT MAX(occurred_at) AS max_at FROM activity_events
    ),
    account_now AS (
      SELECT
        a.id AS account_id,
        (b.max_at AT TIME ZONE 'UTC' AT TIME ZONE a.timezone) AS local_now,
        date_trunc('week', b.max_at AT TIME ZONE 'UTC' AT TIME ZONE a.timezone) AS week_start
      FROM accounts a CROSS JOIN bounds b
    ),
    bucketed AS (
      SELECT
        d.account_id,
        d.event_type,
        (d.occurred_at AT TIME ZONE 'UTC' AT TIME ZONE a.timezone) AS local_ts
      FROM dedup d
      JOIN accounts a ON a.id = d.account_id
    )
    SELECT
      an.account_id AS "accountId",
      an.week_start::date::text AS "weekStart",
      ((an.local_now::date - an.week_start::date) + 1)::int AS "daysIn",
      (an.local_now = an.week_start) AS "isBoundary",
      COUNT(*) FILTER (
        WHERE b.event_type = 'call_received' AND b.local_ts >= an.week_start AND b.local_ts <= an.local_now
      )::int AS calls,
      COUNT(*) FILTER (
        WHERE b.event_type = 'lead_created' AND b.local_ts >= an.week_start AND b.local_ts <= an.local_now
      )::int AS leads,
      COUNT(*) FILTER (
        WHERE b.event_type = 'appointment_set' AND b.local_ts >= an.week_start AND b.local_ts <= an.local_now
      )::int AS appointments
    FROM account_now an
    LEFT JOIN bucketed b ON b.account_id = an.account_id
    GROUP BY an.account_id, an.week_start, an.local_now
    ORDER BY an.account_id;
  `);
  return rows;
}
