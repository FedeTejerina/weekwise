# PLAN — DASH-247: "Is this normal for us?"

Product decisions for DASH-247. `CLAUDE.md` is how we work; this file is what we're building
and why. The reasoning behind every entry is in `ai-log/planning.md` (E1–E10). Numbers here come
from diagnostics run against a scratch copy of the seed; the queries are in the log.

**Status:** planning closed 2026-09-17 (E9, with D18 added in E10). No open decisions; implementation is next.
Decisions D1–D18 are settled, and changing one means a new log entry, not an edit here.

---

## 1. The problem, as we read it

The ticket asks two questions:

1. **"Is this normal for us?"** A customer compares its recent activity with its *own* past,
   not with other customers.
2. **"Which location needs attention?"** A multi-location customer wants to know where to
   look.

Product constraints: an admin reads this on Monday morning and acts on it. It must be
readable at a glance. No alerting and no ML or forecasting, so "normal" must be simple enough
to explain in one sentence.

## 2. What the data allows

These facts constrain every decision below. Evidence is in log entries E1–E4.

- **Low volume.** A typical location has about 4–10 events a week, and whole accounts have
  about 7–76. At location level, counting noise is as large as any plausible change.
- **No location-level signal in the seed, except one event.** Once account 6's spike is
  removed:
  - weekly counts per location behave like pure Poisson noise (variance/mean 0.97; 0 of 69
    locations overdispersed);
  - locations within an account don't differ in volume, or in missed-call, no-show or
    lead-conversion rates.
- **Detection limits.** At the admin's scope (alpha = 0.05 / locations shown):
  - **One location, one week:** a drop is often undetectable, even a week with zero events.
  - **One location, 4 weeks:** only drops of about 40–70% are detectable.
  - **Weekly account total:** changes of about ±25–30% are detectable for the largest
    accounts, but only about −75% to −86% for the smallest single-site accounts.
- **Account 6, 2026-06-03:** 805 events in one day against about 15 on a normal day, across
  all 15 locations. The mix of event types and outcomes is normal, but the burst starts and
  ends exactly on UTC calendar-day boundaries. The cause is unverified.
- **Data-quality facts to handle in code, never in `seed/`:**
  - 12 groups of exact duplicates (24 rows);
  - 398 events with a null outcome;
  - 313 calls with a null duration;
  - account 20 has zero events;
  - account 18 has timezone `UTC`, but its activity peaks during US business hours (unverified
    inference).
- **Data window:** 2026-02-01 → 2026-07-27 UTC, which gives 25 full local weeks (2026-02-02 to
  2026-07-20). The wall-clock date (2026-09-17) is past the end of the data.

## 3. Decisions

| # | Decision | Source |
|---|---|---|
| D1 | **The quiet state is the main output.** "Nothing unusual" is the expected answer on most Mondays, and the design treats it as a result rather than an empty state. | E4 |
| D2 | **The account verdict is weekly:** the last completed local week. | E4 |
| D3 | **The location view uses a 4-week window.** | E4 |
| D4 | **The location view is a significance gate, not raw-change bars.** A location is surfaced only when its 4-week total is unlikely under its own baseline. Supersedes the E4 "bar is the raw change" decision. | E5, built on in E6 |
| D5 | **The user is a customer admin doing a Monday check.** On a normal week the correct action is "nothing to do", and saying so is the point: today the same admin calls their account manager to ask whether 51 calls a week is fine. The page has to answer that question without the call. | E6 (was O1) |
| D6 | **The gate runs on the selected event type** — `call_received`, `lead_created` or `appointment_set` — one at a time. It tests **volume, not rates**: outcome rates (missed, no-show, converted) are never gated. | E6, corrected in E8 (was O2, O12) |
| D7 | **"Now" comes from the data, not the clock:** the as-of moment is the latest `occurred_at` in the dataset (2026-07-27 22:20:34 UTC in the seed), and the default week is the latest completed local week at that moment. For every account in the seed that is 2026-07-20 – 07-26, because the local as-of time is Monday 2026-07-27 everywhere from `America/Los_Angeles` (15:20) to `UTC` (22:20). | E6, refined in E8 and E10 (was O3) |
| D8 | **The baseline is a trimmed mean of the 12 full weeks** before the evaluated window: drop the highest and the lowest week, average the remaining 10. Minimum history: 16 full weeks for the location gate (12 + 4) and 13 for the account verdict (12 + 1). Less than that means "not enough history". **Moved from the median in E9**, because per event type (D6) the median was biased low at about 1 event a week and produced false rises; see §4. | E6 (was O4), changed in E9 (was O14) |
| D9 | **Account 6's 2026-06-03 is treated as real activity.** It is flagged in its own week. D8's trimmed baseline keeps it from distorting later weeks (0 echo flags, §4), and nothing is excluded by hand. | E6 (was O5), baseline updated in E9 |
| D10 | **The weekly account verdict uses the same gate** as the location view, applied to the account's weekly total (window = 1 week, k = 1). | E6 (was O7) |
| D11 | **Direction and size are shown only after the gate passes.** A quiet result shows no change percentage. | E6 (was O8) |
| D12 | **`accounts.timezone` is used as stored.** Account 18 (`UTC`, but with a US-hours activity profile) is a known data question and is not corrected in code. | E6 (was O9) |
| D13 | **The gate is T3:** a negative binomial predictive test, with familywise α = 5% per account-Monday. See §4. | E7 (was O6) |
| D14 | **The stack is React + Node (TypeScript), PostgreSQL 16 in Docker Compose, and Vitest.** See §5. | E7 (was O11) |
| D15 | **Three controls, all held in the URL** so they survive a reload: account, event type and week. The week defaults to D7's latest completed week and can be moved backwards. | E8 |
| D16 | **Page layout:** the account verdict and its usual range on top. Below it, locations appear only when the gate flags them; otherwise a single line says nothing unusual at any location. Single-site accounts get no location section at all. | E8 (was O10) |
| D17 | **The account is chosen by id in the URL, with no authentication.** This is stated as a limitation in the README. | E8 (was O13) |
| D18 | **The in-progress week is shown as a plain fact, never judged.** A single line gives the count of the selected event type so far and how many days into the week it is. No verdict, no usual range, no percentage, no comparison. It exists so that someone opening the page on a Wednesday can see the data is current, instead of reading the last completed week as stale. | E10 |

### Rules that follow from D1–D18 and from the data

- **Weeks** are Monday–Sunday in the account's IANA timezone. Events are bucketed by local
  date and then summed; a 4-week window is always 28 local days.
- **Only completed weeks** are evaluated. The in-progress week is never compared, never
  baselined and never part of a window — but it is displayed, as a count (D18).
- **Exact duplicates** (every column except `id` identical) are counted once.
- **Zero-activity weeks** exist as explicit zeros. Any rolling window over weeks depends on this.
- **Each location is compared with its own history,** not with sibling locations. The seed
  shows no real differences between siblings to find.
- **The baseline must be robust *and* unbiased at low counts.** A plain mean lets account 6's
  spike day into the baseline and produces false drop flags afterwards (36 across 11 locations
  in E5's all-types run; 14 per-type in E8). A median avoids that but reads low at about 1
  event a week and produces false rises. Trimming the highest and lowest week (D8) does both
  jobs; §4 has the numbers.
- **Every location gets one of three states, never two:** unusual, normal, or not enough
  history. Without the third state, "we couldn't tell" would be shown as "normal".

## 4. The gate (D13)

**Specification.** For a window of `w` weeks (w = 4 per location, w = 1 for the account
total) with observed total `x` and baseline weekly rate `m` — the trimmed mean of the 12
preceding weeks, highest and lowest dropped, so 10 weeks contribute (D8):

- predictive distribution: `NegBin(r = 10·m, p = 10 / (10 + w))`, whose mean is `w·m`;
- `DOWN` if `CDF(x) < α`; `UP` if `1 − CDF(x − 1) < α`; otherwise quiet;
- `α = 0.05 / (2k)`, where k = number of locations in the account for the location gate and
  k = 1 for the account verdict;
- `m` is floored at 0.1 so that `r > 0`. In the seed the floor is reached only by appointments,
  in 3 of 690 location evaluations per type; the lowest baselines are 2.0 (calls), 0.3 (leads)
  and 0.1 (appointments) per location, and 3.4 / 1.4 / 0.6 per account (E9).

**The usual range** shown with a verdict (D16) is the gate's quiet interval: the counts that
would *not* be flagged, `[lo, hi]` where `lo` is the smallest count with `CDF ≥ α` and `hi` the
largest with `1 − CDF(hi) ≥ α`. It needs no separate definition and no separate test, and it is
also how a small account sees its own detection limit: account 16's usual week is 1–10 calls.

**The gate as specified, measured per event type** (`scratchpad/estimators2.py` and
`per_type.py`, logged in E8 and E9). Account 6 is excluded from the "location flags" and
"verdict flags" columns. "Noise" is the share of Mondays that are not quiet under simulated
Poisson data at each location's own rate, against a 5% budget.

| event type | typical location week | location flags | acct 6 locations flagged on 06-01 | verdict flags | noise: Mondays not quiet (location / verdict) | evaluations hitting the 0.1 floor |
|---|---|---|---|---|---|---|
| `call_received` | 4 | 4 | 15/15 | 10 / 246 | 3.2% / 3.7% | 0 |
| `lead_created` | 1 | 4 | 11/15 | 5 / 246 | 3.9% / 2.2% | 0 |
| `appointment_set` | 1 | 9 | 5/15 | 3 / 246 | 4.4% / 2.9% | 3 |

Appointments are caught only 5 times in 15 on account 6's spike day, because a location sees
about one appointment a week. At that volume nothing reliable can be said, and the usual range
says so.

### Why D8 moved from the median to a trimmed mean (E9)

The D6 correction — gating one event type at a time — exposed the median. Location flags per
type (calls / leads / appointments), the noise share against the same 5% budget, and "echo",
meaning account 6 locations flagged as *drops* in the weeks after its spike day:

| baseline | location flags | noise, location | echo | acct 6 spike caught |
|---|---|---|---|---|
| median (D8 until E9) | 6 / 21 / 57 | 6.9% / 11.8% / 20.9% | 0 | 15 / 11 / 8 |
| plain mean | 6 / 5 / 10 | 3.8% / 3.3% / 3.0% | **14** | 15 / 11 / 5 |
| drop the highest week | 7 / 5 / 14 | 5.1% / 5.8% / 5.5% | 0 | 15 / 14 / 7 |
| **drop highest and lowest (D8 now)** | **4 / 4 / 9** | **3.2% / 3.9% / 4.4%** | **0** | 15 / 11 / 5 |

- The median is robust but reads low at about 1 event a week, so ordinary weeks look like
  rises, and a median of 0 plus the floor made a handful of events significant (149 of 690
  appointment evaluations sat on the floor).
- The plain mean is accurate but not robust: account 6's spike day enters the baseline and
  produces 14 false drops.
- Trimming both ends keeps the robustness, removes the low-count bias, and brings every event
  type inside the noise budget. It costs some sensitivity, visible in the appointment row above.

### Why T3: the options measured

These are the measurements that chose T3 as the test family, made before the D6 correction and
therefore on all event types combined. Every option uses the D8 baseline (median of the 12
prior weeks) and splits alpha across both directions and across the k locations shown (k = 1
for the account verdict). The measurements come from `scratchpad/thresholds.py` and are logged
in E6. "Noise" means simulated Poisson data at each location's median rate, 400 runs, with
account 6 excluded.

| option | test | familywise alpha per account-Monday |
|---|---|---|
| **T1** | Poisson with mean `window × median` | 5% (0.05 / 2k per side) |
| **T2** | same as T1 | 1% (0.01 / 2k per side) |
| **T3** | Negative binomial predictive: `nbinom(n = 12·median, p = 12/(12+window))`, same mean as T1 with the uncertainty of a 12-week baseline added | 5% (0.05 / 2k per side) |

**On the seed.** Account 6 is excluded from the first three columns; the account-6 columns
check that the spike is caught and leaves no echo.

| | location flags (flag streaks) | account-Mondays with any location flag | account verdict flags | acct 6: locations flagged on 06-01 | acct 6: false "drop" flags after the spike | acct 6 verdict on 06-01 |
|---|---|---|---|---|---|---|
| E5 (reference) | 24 (20) | 21 / 180 (12%) | 22 / 246 (9%) | 15 / 15 | 0 | UP |
| T1 | 14 (11) | 14 / 180 (8%) | 16 / 246 (7%) | 15 / 15 | 0 | UP |
| T2 | 3 (2) | 3 / 180 (2%) | 6 / 246 (2%) | 15 / 15 | 0 | UP |
| T3 | 4 (3) | 4 / 180 (2%) | 14 / 246 (6%) | 15 / 15 | 0 | UP |

**How often pure noise makes a Monday look "not quiet".** Compare each option with its
nominal rate (5%, or 1% for T2):

| | account-Mondays with any location flag | account verdict flagged |
|---|---|---|
| T1 | 12.8% (nominal 5%) | 4.9% |
| T2 | 4.4% (nominal 1%) | 1.2% |
| T3 | **6.1%** (nominal 5%) | **4.4%** |

**What each option catches** (share of injected real changes flagged, 2,000 runs each):

| | location 6/wk in a 5-location account, −50% for 4 wks | same, −30% | location 10/wk in a 15-location account, −50% | account 30/wk, −40% for 1 wk | account 50/wk, −30% for 1 wk |
|---|---|---|---|---|---|
| T1 | 46% | 12% | 62% | 61% | 58% |
| T2 | 27% | 6% | 44% | 35% | 32% |
| T3 | 34% | 7% | 50% | 57% | 54% |

**Why T3:**
- **It's the only option whose real false-flag rate matches its stated one.** T1 and T2 treat a
  12-week median as exact. At location level, that makes T1 fire about 2.5× and T2 about 4×
  more often than their nominal rates.
- **It's close to T2 at location level (quiet) and close to T1 at account level (sensitive).**
  It adds uncertainty where the baseline is thin, and little where it's large.
- **It's easy to explain:** "flagged when this period falls outside what your previous 12
  weeks would produce 19 times out of 20".

**What T3 costs:** a location's sustained −50% drop is caught only about one time in three,
and a −30% drop almost never. That's the price of a quiet state at 4–10 events a week. The
page must therefore never imply that "quiet" means "checked and fine" when it only means
"no evidence of change" (see §7).

**Streaks:** no additional suppression of repeat flags is proposed. Under T3 the seed has
3 flag streaks outside account 6, so collapsing them would change little.

## 5. Stack (D14)

React + Node was your choice (E7): the exercise asks for your strongest stack. PostgreSQL 16
in Docker Compose and Vitest are also your calls. The rows marked *proposed* are my picks
within that choice; change them freely.

| layer | choice | notes |
|---|---|---|
| Language | **TypeScript** everywhere, Node 22 | Node 22.12 is installed on this machine. |
| Database | **PostgreSQL 16** via `compose.yaml` | Verified in E7: `seed/schema.sql` and `seed/seed.sql` load unchanged into `postgres:16` (16.15), with 20 accounts and 12,626 events. The weekly bucketing below, written in Postgres SQL, reproduces the diagnostics exactly: 69 locations × 25 weeks, 12,517 events. |
| API | **Fastify 5** | Your call (E8). Typed routes and schema validation built in, and `app.inject()` lets Vitest call routes without opening a port. |
| DB access | **`pg` (node-postgres) with hand-written SQL**, no ORM *(proposed)* | The logic lives in window functions, `AT TIME ZONE` and `generate_series`, so an ORM would get in the way. |
| Migrations | **`node-pg-migrate` 9 with plain-SQL migration files** (`-j sql`) | An established library rather than a hand-written runner (your call, E8), and it uses `pg`, which the app already has. Verified in E8 against Postgres 16: `up`, `down` and `up` again all work, and the first migration's header says what it adapts from `seed/schema.sql` (CLAUDE.md rule 3). |
| Seed loading | **`npm run db:seed`**, a Node script that runs `seed/seed.sql` in one transaction | Verified in E8: loads into the migrated schema in 494 ms, giving 20 accounts and 12,626 events. The file is read, never modified. |
| Gate statistics | **`@stdlib/stats-base-dists-negative-binomial-cdf`** | Checked in E7 against scipy on 73 T3-shaped cases, including non-integer `r`: worst relative error 3.2e-14. `jstat` returned NaN on some of those cases and is rejected. |
| Web | **React + Vite + TypeScript**, one page per account *(proposed)* | Read-only Monday view. Plain `fetch`; no state library until one is needed. |
| Tests | **Vitest** for everything. See below. | |

### Tests

| layer | how | what it pins |
|---|---|---|
| Gate (unit) | Vitest; pure functions, no database | The §4 specification. The negative binomial CDF must agree with a committed scipy fixture (`scripts/` holds the generator, run once with `uv run --with scipy`). |
| SQL (integration) | Vitest against a real Postgres 16 loaded with the seed, via `@testcontainers/postgresql` on the same image as `compose.yaml` *(proposed)* | Every check in §12. The database is never mocked, because timezone bucketing and deduplication happen in SQL. |
| API | Vitest + `fastify.inject()` | Response shapes, including the three states, and the pinned as-of date (D7). |
| Web | Vitest + Testing Library + jsdom | Quiet, flagged and not-enough-history states render as specified, and a quiet result shows no percentage (D11). |

**Time zones in Node.** By default, `pg` converts `timestamp` (without time zone) and `date`
columns into JS `Date` objects in the Node process's local time zone. The rules to follow:
- All bucketing happens in SQL.
- Queries return week starts as `text`.
- The `timestamp` type parser is pinned to UTC.
- The test suite runs with `TZ=America/Los_Angeles`, so any shift fails loudly.

**Where the logic sits:** SQL does deduplication, local-week bucketing, zero-filling and
window sums (below). TypeScript does the gate test and the wording.

```sql
-- weekly counts per location; verified in E7
WITH dedup AS (
  SELECT DISTINCT account_id, location, event_type, occurred_at, duration_seconds, outcome
  FROM activity_events),
bucketed AS (
  SELECT d.account_id, d.location,
         date_trunc('week', (d.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE a.timezone)::date AS week_start
  FROM dedup d JOIN accounts a ON a.id = d.account_id),
weeks AS (SELECT generate_series('2026-02-02'::date, '2026-07-20'::date, '7 days')::date AS week_start),
locations AS (SELECT DISTINCT account_id, location FROM bucketed)
SELECT l.account_id, l.location, w.week_start, COUNT(b.week_start) AS n
FROM locations l CROSS JOIN weeks w
LEFT JOIN bucketed b USING (account_id, location, week_start)
GROUP BY 1, 2, 3;
```

The week range is hard-coded to the seed here. In the app it is derived from the as-of date
(D7) and the history D8 needs.

### First migration: what it adapts from `seed/schema.sql`

Verified in E8 (the seed loads into it unchanged):
- a `CHECK` constraint on `event_type` for the three known values;
- `CHECK (duration_seconds >= 0)`;
- an index on `(account_id, event_type, occurred_at)` for the weekly aggregation;
- **no unique constraint across the event columns.** The 12 duplicate groups are real data and
  must load. Deduplication happens in the query, per D-rules in §3.

## 6. API and UI

**`GET /api/accounts`** — the account picker: id, name, timezone, location count.

**`GET /api/weekly-check?account=<id>&type=<event_type>&week=<YYYY-MM-DD>`** — one call
returns everything the page renders. It does the real aggregation: deduplication, local-week
bucketing, zero-filled weeks, the 4-week rolling sums, and the gate. Response:

```jsonc
{
  "asOf": "2026-07-27T22:20:34Z",    // D7, the latest occurred_at in the data
  "week": { "start": "2026-06-01", "end": "2026-06-07", "isLatest": false },
  "inProgress": {                    // D18; null when the as-of moment is exactly a week boundary
    "weekStart": "2026-07-27", "daysIn": 1, "count": 7
  },
  "weeks": ["2026-02-02", "…"],      // selectable weeks, for the week control
  "account": { "id": 6, "name": "Metro Collision Centers", "locationCount": 15 },
  "verdict": {
    "state": "flagged_up",           // quiet | flagged_up | flagged_down | not_enough_history
    "count": 528, "typical": 45.5, "usualRange": [32, 60],
    "changePct": 1060                // present only when flagged (D11)
  },
  "locations": {                     // omitted entirely for single-site accounts (D16)
    "window": { "start": "2026-05-11", "end": "2026-06-07" },
    "flagged": [{ "location": "Site N", "state": "flagged_up", "count": 72, "usualRange": [8, 31] }],
    "notEnoughHistory": ["Site P"],
    "quietCount": 0
  }
}
```

**Controls (D15).** URL: `/?account=6&type=call_received&week=2026-06-01`. All three survive a
reload and work with the browser's back button. Defaults: first account, `call_received`,
D7's latest completed week. Invalid or out-of-range values fall back to the default and the URL
is rewritten.

**States.** Every level renders one of: quiet, flagged up, flagged down, or not enough history
(§3). A location with too little history is listed by name, so "nothing unusual" never hides a
location the gate could not judge.

**The in-progress week (D18).** `inProgress` counts the selected event type from the start of
the account's current local week up to the as-of moment, with duplicates removed as everywhere
else. `daysIn` is the day number of the as-of date within that week: 1 on Monday, 3 on
Wednesday. The line is always shown, whichever past week is selected, and it names its own
dates so it can't be mistaken for the verdict's week. It is `null` only if the as-of moment
falls exactly on a week boundary, when there is no in-progress week to report.

## 7. What the page says (the deterministic template)

Written before deciding anything about an LLM (§8 decides it). Every line is filled from the
response in §6; nothing else is shown. All numbers below are real output of the gate as
specified in §4, verified in E9.

**Account verdict — quiet (most weeks).** Account 1, calls, week of 20 July:
> **34 calls** in the week of 20–26 July. That's **normal for you** — your usual week is
> **20 to 42 calls**.

**Account verdict — flagged up.** Account 6, calls, week of 1 June:
> **528 calls** in the week of 1–7 June, against a usual **31 to 58**. That's about **12×** your
> typical week.

**Account verdict — flagged down.** Account 7, calls, week of 13 July:
> **3 calls** in the week of 13–19 July, against a usual **5 to 18**. That's about **73%** below
> your typical week.

**Account verdict — not enough history:**
> Not enough history yet. Judging a normal week takes 13 weeks of data; you have 9.

**The in-progress week (D18).** One line, above or beside the verdict, never inside it.
Account 6, calls, as-of Monday 27 July:
> This week so far: **7 calls**, 1 day in (Mon 27 July).

With nothing yet — accounts 2, 8 and 20 on the seed:
> This week so far: **no calls yet**, 1 day in (Mon 27 July).

On a Wednesday it would read "3 days in (Mon–Wed 29 July)". There is no range, no percentage
and no verdict on this line, because 3 days of a week cannot be compared with whole weeks.

**Locations — quiet (D16):**
> Nothing unusual at any of your 15 locations over the 4 weeks to 7 June.

**Locations — flagged.** Account 6, Site N, calls, 4 weeks to 7 June:
> **Site N — 40 calls** over the 4 weeks to 7 June, against a usual **2 to 24**.

**Locations — not enough history:** listed by name, so the quiet line never covers them.

**Wording rules:**
- The usual range is always shown, quiet or not. It is what tells a small account that its
  normal week is 1 to 10 calls, so a quiet result never reads as "checked and fine" (§4).
- A percentage appears only when the gate has fired (D11).
- The words are the same every Monday. Same numbers in, same sentence out.
- Zero is written as "no calls yet", not "0", so a quiet start to the week doesn't read as a
  broken page.

## 8. Where would an LLM fit?

**Not in this feature, for now.** The template in §7 covers the whole output: four account
states × three event types, plus two location states. That is a small, enumerable space where
every sentence is a number and a comparison. A model would add cost, latency and a chance of
misstating a number, in exchange for phrasing that a template already gets right. "No ML or
forecasting" is also explicit in the ticket, and while wording is not forecasting, an admin
cannot tell the difference when the sentence is wrong.

**The candidate we rejected, and why.** The tempting use is free-text follow-up: *"why was Site
N high in June?"* The data cannot answer that. It has counts, types, outcomes and durations, but
no campaigns, staffing, weather or holidays. A model asked "why" with only these columns will
produce a plausible cause, which is the one output worse than silence here. The honest answer
to "why" is the composition of the change, which is a query, not a model: on 2026-06-03 all 15
locations rose together with a normal mix of outcomes, bounded by the UTC day.

**What would change this.** An LLM earns its place when the output space stops being
enumerable, for example:
- once causal context exists (campaign calendars, staffing rosters, opening hours), summarising
  across sources for a flagged week;
- free-text questions over a customer's own history, with the model restricted to calling the
  aggregation endpoint and quoting its numbers;
- account-manager-facing summaries across many accounts, where the variety is real.

**What a stub would cost, and why we're not building one.** The brief accepts a stubbed
boundary with the real prompts committed, and no API key, so cost is not the objection. The
objection is that a stub here is inert: the seam would be
`explain(verdict, facts) -> string`, and the only implementation that ever runs is the §7
template. Committing prompts alongside it would mean writing and maintaining wording that
nothing produces, plus a fake provider, its tests, and a second set of sentences that can drift
from the template's. That is work whose entire output is a claim we can make in a paragraph:
the seam is one function, and the day there is something worth generating, the template stays
as its fallback.

So the boundary is specified, not built:
- `explain(verdict, facts) -> string`, called after the gate, never before it;
- the gate's numbers are computed by §4 and are never re-derived or restated by a model;
- the default implementation is the §7 template, and it remains the fallback for any future
  provider;
- if a provider is ever added, the facts it receives are exactly the §6 response, and its output
  is checked to quote those numbers unchanged.

If the reviewer would rather see the stub than the argument, it is a small addition and the
prompts would be the §7 sentences, so nothing about the plan changes.

## 9. Deliverables and how it runs

### The brief's requirements, and where each is met

| requirement | where | status |
|---|---|---|
| Backend: at least one endpoint doing real aggregation, not pass-through | `GET /api/weekly-check` (§6): deduplication, local-week bucketing, zero-fill, 4-week rolling sums, gate | planned |
| Frontend: a web UI consuming it, with user-controlled state that survives a reload | React page (§6) with account, event type and week in the URL (D15) | planned |
| Tests that run, plus a one-line README note | Vitest across four layers (§5); `npm test`; checks in §12 | planned |
| Relational database with a real schema and migrations in the stack's standard tooling, loaded from the seed | Postgres 16, `node-pg-migrate` SQL migrations, `npm run db:seed` — both verified in E8 (§5) | verified |
| Runs locally from the README in about 15 minutes | Four commands below; the slow part is the Postgres image pull and `npm install` | to be timed on a clean clone |
| PLAN.md has a "Where would an LLM fit?" section | §8, written after the deterministic template in §7 | done |

### Running it

| item | plan |
|---|---|
| Run locally in about 15 minutes | `docker compose up -d` (Postgres 16), `npm install`, `npm run db:setup` (migrations + seed, about 0.5 s for the seed), `npm run dev`. Prerequisites: Node 22 and Docker, both present on this machine. |
| Tests, with a one-line README note | `npm test` runs every Vitest project (unit, SQL, API, web). Docker must be running for the SQL tests. |
| README | Setup, the one-line test command, what the page means, and the limitations: no authentication (D17), the as-of moment comes from the data (D7), account 18's timezone (D12), and account 6's 2026-06-03 (D9). |

## 10. Decisions closed in E9 and E10

- **O14 → D8.** The baseline is the trimmed mean. Why it moved, and the numbers behind it, are
  in §4 rather than here, so the reasoning sits next to the specification.
- **O15 → §8.** A stubbed boundary with committed prompts is acceptable to the brief, and the
  deferral stands anyway. §8 now says what a stub would cost and why the argument is worth more
  than the artefact here.

**No open decisions remain. Planning is closed; implementation is next.**

## 11. Out of scope

- Alerting and notifications (product).
- ML and forecasting (product).
- Comparisons against other customers or industry benchmarks, because "normal *for us*".
- Edits to `seed/` (repo rule). Every data issue is handled in queries and code.

## 12. Checks the implementation must pass on the seed

These come straight from the data. They are behaviours, not tests of any particular design.

**Data handling**
- Account 20 (no events) renders as "not enough history" and does not error.
- The 12 duplicate groups count once: after deduplication the 25 full weeks hold 12,517 events
  across all types, 7,708 calls, 3,023 leads and 1,786 appointments.
- Bucketing uses local time: a call at 2026-06-03 02:30 UTC belongs to Tuesday 2026-06-02 for
  an America/New_York account, in the week starting 2026-06-01.
- A partial week (2026-07-27 onward) is never evaluated, and the default week is 2026-07-20.
- **The in-progress line (D18) reports the partial week without judging it.** On the seed, with
  as-of 2026-07-27 22:20:34 UTC, every account is 1 day into the week of 2026-07-27, and calls
  so far are: account 6 → 7, account 5 → 6, account 12 → 6, account 1 → 3, and accounts 2, 8
  and 20 → none yet. The partial week never enters a baseline, a window or a verdict: the
  2026-07-20 verdict is identical whether or not the line is rendered.
- Migrations run `up`, `down` and `up` cleanly, and `seed.sql` loads into the migrated schema
  unchanged: 20 accounts, 12,626 rows.
- Results are identical when the Node process runs in a non-UTC time zone (tests run with
  `TZ=America/Los_Angeles`).

**Gate**
- The account 6 week of 2026-06-01 is flagged at account level for calls. After the spike day
  leaves the current window, no account 6 location is flagged as a drop because of it.
- Accounts 16 and 19 (single-site, about 7–8 events a week) never show a flag they can't
  support, and their usual range is always visible.
- The negative binomial CDF agrees with the committed scipy fixture.
- **Regression anchor, weeks 2026-05-18 … 2026-07-20, D8's trimmed mean:** 15/15 account 6
  locations flagged up for calls on 2026-06-01, 0 drops afterwards, and outside account 6
  4 / 4 / 9 location flags for calls / leads / appointments. The §4 tables are the full anchor.
  If a count changes, it is re-measured, not adjusted by hand.
- **Verdict wording matches §7 exactly** for these cases: account 1 calls 2026-07-20 (quiet,
  34, usual 20–42), account 6 calls 2026-06-01 (up, 528, usual 31–58), account 7 calls
  2026-07-13 (down, 3, usual 5–18), account 6 Site N calls 4 weeks to 2026-06-07 (up, 40,
  usual 2–24).

**UI**
- The three controls round-trip through the URL: reload and browser-back restore account, event
  type and week (D15).
- Out-of-range or malformed URL parameters fall back to defaults without an error page.
- A quiet verdict shows no percentage (D11); a single-site account shows no location section
  (D16).
- Account 6 with `week=2026-06-01` shows the flagged state end to end. This is the demo path.
