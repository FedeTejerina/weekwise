# WeekWise

A read-only dashboard that answers two questions for a customer admin doing a Monday check-in:

1. **"Is this normal for us?"** — is this account's recent activity (calls, leads, or
   appointments) unusual compared with its *own* history, not with other customers.
2. **"Which location needs attention?"** — for multi-location accounts, which specific site is
   behind the change.

No alerting, no machine learning, no forecasting — the brief rules those out, and the answer is
built to be explainable in one sentence.

This README covers the stack, how to run it, and the assumptions a reviewer would otherwise
mistake for bugs. What was actually cut, what a later code review found and left alone, and a
timed clean-clone run are recorded at the bottom.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript everywhere, Node 22 | One language across the API, the gate logic, and the web UI. |
| Database | PostgreSQL 16, via Docker Compose | The seed's schema and data load into it unchanged; window functions and `generate_series` do the weekly bucketing without an ORM in the way. |
| DB access | `pg` (node-postgres), hand-written SQL | The aggregation logic — deduplication, per-account local-week bucketing, zero-filling, rolling windows — is naturally SQL. An ORM would obscure it, not simplify it. |
| Migrations | `node-pg-migrate`, plain-SQL migration files | An established runner rather than a hand-rolled one, using the same `pg` driver the app already depends on. |
| Seed loading | `npm run db:seed` | Reads `seed/seed.sql` and runs it in one transaction against the migrated schema. The seed file is read, never modified — see "the seed is read-only" below. |
| API | Fastify 5 | Typed routes with request validation built in; its test helper calls routes directly without opening a real port. |
| Gate statistics | `@stdlib/stats-base-dists-negative-binomial-cdf` | The significance test (below) needs a negative-binomial CDF; this library agreed with `scipy` to within 3.2e-14 on the cases exercised here. |
| Web | React + Vite + TypeScript | One page, plain `fetch`, no state management library — the UI has three controls and one view. |
| Tests | Vitest, in four projects: `unit`, `sql`, `api`, `web` | `unit` is pure functions, no database. `sql` runs against a real, seeded Postgres 16 — the timezone and dedup logic live in SQL, so it's tested there, not mocked. `api` exercises the Fastify routes. `web` renders the UI states. |

**The statistical method, briefly:** each week, a location or account's activity is compared
against a baseline built from its own preceding 12 weeks (the highest and lowest of those 12 are
dropped, and the rest are averaged, to resist both a one-off spike and a chronically low
median). A negative-binomial test then asks whether the current count is a surprising draw from
that baseline, at a strict significance threshold split across every location shown. This is why
a quiet week is not "nothing happened" — it's "nothing statistically surprising happened," and the
dashboard always shows the usual range alongside the verdict so a small account can see just how
wide "normal" is for it.

## Running it

Prerequisites: **Node 22** and **Docker**, both expected to already be present.

```
docker compose up -d      # starts Postgres 16
npm ci                    # installs exactly what package-lock.json pins
npm run db:setup          # runs migrations, then loads seed/seed.sql
npm run dev                # starts the API and the web UI
```

Then open the app and pick an account from the URL or the picker.

**Tests:** `npm test` runs all four Vitest projects (`unit`, `sql`, `api`, `web`). Docker must be
running first — the `sql` project executes real queries against the seeded database.

> **Status:** all four commands above have been run, in order, against a genuinely fresh clone,
> reaching a working page — see [Clean-clone run](#clean-clone-run) below for the timing and
> the one machine-specific deviation it needed.

## What moment is the page showing, and why isn't it "today"?

The page never asks the system clock what day it is. Instead, "now" is defined as **the latest
event timestamp anywhere in the dataset**. In the seed data that's 27 July 2026, and the default
week shown is the most recently *completed* Monday–Sunday week before that moment, in each
account's own timezone — the week of 20–26 July.

This matters because the dataset is a fixed, frozen export (`seed/seed.sql`), not a live feed. Its
events stop in late July 2026. If the page instead asked the real wall clock what day it is, every
week would show up empty — there's no data past the point the export was taken. Anchoring "now" to
the data itself means the dashboard shows exactly what it would have shown to somebody looking at
it on the day the export ended, and it will keep making sense however long this dataset sits
around.

## Why is the 3 June spike at account 6 left in the data, not cleaned out?

One account (account 6) has a single day — 3 June 2026 — where every one of its 15 locations
recorded a burst of activity roughly 80× a normal day for that account, all landing inside one UTC
calendar day. It is left in the data untouched, for two reasons:

1. **The seed is handed to us as read-only material.** `seed/seed.sql` and `seed/schema.sql` are
   never edited, regenerated, or "cleaned" — every quirk in the data (duplicates, nulls, this
   spike) is handled in the query and application code, not by rewriting the input.
2. **It's the wrong thing to remove even if it were allowed.** The entire point of this feature is
   to say whether a week is normal for a given account. A genuine spike is exactly the kind of
   event the dashboard exists to surface, not noise to filter out before the reader sees it. So the
   spike's own week is flagged as unusual, honestly — the page will show account 6 as sharply "up"
   for the week of 1 June. What it does *not* do is let that single week distort every week after
   it: the statistical baseline described above deliberately drops the account's single highest
   week (among other things) before computing what's "usual," specifically so one burst doesn't get
   baked into the comparison and cause false "you're down!" alerts for months afterward.

## Why is there no login, and how does the page know which account to show?

There's no authentication at all in this exercise. The account being viewed is chosen entirely by
an id in the URL (e.g. `?account=6`), with no session, no password, and no check that the visitor
is allowed to see that account's data.

This is a deliberate scope limitation, not an oversight: the exercise is about the aggregation and
statistics behind the dashboard, not about building an auth system, and adding one would be pure
overhead against that goal. In a real product this page would sit behind whatever
session/account-scoping already exists elsewhere in the platform; nothing here assumes it couldn't.

## Is an LLM used anywhere in this feature, and why (not)?

**No, not in this feature.** Every sentence the page shows is filled in from a small, fixed
template: a handful of verdict states (quiet, flagged up, flagged down, or "not enough history
yet"), crossed with the three event types the picker offers, plus two similar states for
individual locations. That's a small, fully enumerable space, and every sentence in it is just a
number and a comparison substituted into fixed wording. An LLM would add latency, cost, and — most
importantly — a real chance of misstating one of those numbers, in exchange for phrasing a plain
template already gets right. The brief also explicitly rules out ML and forecasting, and while
wording isn't forecasting, a reader can't tell the difference when a sentence states the wrong
number.

The tempting counter-case is a free-text follow-up like *"why was this location high in June?"*
That was considered and rejected: the data has counts, event types, outcomes, and call durations,
but nothing about *causes* — no campaigns, staffing changes, or holidays. An LLM asked "why" with
only those columns would produce a plausible-sounding guess, which is worse than no answer at all
for something a customer might act on.

Where a model *would* earn its place: once there's actual causal context to summarize (campaign
calendars, staffing rosters), for free-text questions restricted to calling the same aggregation
this page already trusts and quoting its numbers verbatim, or for account-manager-facing summaries
across many accounts at once, where the variety of things worth saying is real rather than
enumerable. The wording layer is written behind a narrow seam (`explain(verdict, facts) ->
string`) precisely so a model could slot in there later without touching the statistics above it —
but the only implementation that exists, or needs to exist for this exercise, is the deterministic
template.

## Assumptions and known limitations

- **No authentication; the account is chosen by an id in the URL.** Covered above.
- **"Now" comes from the data, not the clock.** Covered above — the default view is pinned to the
  latest completed week as of the dataset's last event, currently the week of 20–26 July 2026.
- **Account 6's 3 June spike is real activity, not cleaned.** Covered above.
- **One account's stored timezone looks wrong, and is used anyway.** Account 18 is stored as
  `UTC`, but its activity pattern looks like it's actually running on US business hours. The
  timezone column is used exactly as stored, uncorrected — this is a known data question, not a
  bug in the bucketing logic, and "fixing" it would mean guessing at a timezone the data doesn't
  actually state.
- **Duplicate rows are collapsed in the query, not in the data.** A small number of exact-duplicate
  event rows exist in the seed (same account, location, event type, timestamp, duration, and
  outcome, differing only in their row id). They're counted once wherever the app aggregates
  activity; the underlying seed file keeps them, unedited, as delivered.
- **The seed (`seed/seed.sql`, `seed/schema.sql`) is read-only material for this whole project,**
  by rule, not just by convention — every oddity in it is a fact to handle in code, never a defect
  to fix at the source.
- **Postgres runs on host port 5432 by default, no setup needed.** If that port is already taken
  on your machine, set `DB_PORT` (e.g. `DB_PORT=5433`) before running `docker compose up` — both
  Compose and `migrate-config.js` read the same variable.
- **`npm audit` reports one moderate advisory**, in `uuid`, reached through `dockerode` via
  `testcontainers` (used only by the `sql` test suite). Not fixed: `npm audit fix --force` jumps
  `testcontainers` to a version that requires Node 22.22, which this Node doesn't meet. It's a
  dev-only, test-only dependency that never ships, and the `uuid` it pulls in generates container
  labels, not attacker-controlled input.
- **Every dependency is pinned to an exact version** (`.npmrc`'s `save-exact=true`, and every
  `package.json` written without a `^` or `~`). This is about reproducible installs — the same
  clean clone giving the same `node_modules` a year from now — not supply-chain hardening; it
  doesn't check what a package does, only that the version doesn't silently drift.

## What was cut

Nothing. Every item on the plan's own cut list — T13's component tests, T10's `explain()` seam,
T14 running against `testcontainers` instead of the developer's own Compose database, T11's full
week control rather than just the default week, and T9's in-progress line — shipped. Saying so
plainly here rather than leaving the section silent: from outside, an item that was never taken
off the list and one that quietly vanished look identical unless someone states which.

## Known gaps, found in code review, left deliberately

A review pass (`ai-log/review.md`, entry R1) found ten issues. Seven were fixed
(`ai-log/implementation.md`, I30). These three were not — each would mean changing something
already independently verified, and none is reachable on this seed or through the page's own
documented flow:

- **The TypeScript and the Python oracle can disagree about which locations exist, and whether
  an account has any history at all** (`server/src/db/aggregation.ts`,
  `server/src/weeklyCheck.ts`). Both currently count a location, or mark an account as having
  history, from *every* recorded event — including one that only ever happened in the
  still-elapsing in-progress week, before it has entered a full-week series. On this seed that
  never happens: log I3 already established that no location's history is confined to fewer
  than 16 full weeks by the earliest evaluable point. Fixing it for real means changing the
  inclusion rule in both gate implementations together (CLAUDE.md rule 4) and re-running T5b's
  oracle and T15's regression anchor against the new numbers — real work, on a case the seed
  can't exercise and the review didn't reproduce, only reasoned through by reading the code.
- **The Activity picker can show the wrong noun for a few hundred milliseconds.** Changing the
  event type updates the URL immediately, but the verdict still shows the *previous* type's
  numbers until the new fetch returns — briefly, "34 leads" next to a usual range that's
  actually calls. The API's own response carries no `type` field to render from instead of the
  URL, and adding one changes the response shape `PLAN.md` §6 documents and `server/test/api`
  already pins. In normal use it resolves before anyone can read it; it only persists if that
  specific fetch then fails.
- **`/api/weekly-check` reads the database twice per request** — once to validate the requested
  account and week, once again inside `weeklyCheck()` itself to evaluate them — against two
  separate snapshots taken moments apart. On a live, writable dataset those could disagree; on
  this frozen seed they can't. Collapsing it to one read means a `weeklyCheck()` variant that
  accepts already-fetched data, threaded through the one API path every test in
  `server/test/api` already exercises — not a local, isolated change.

## With another day

- Fix the three gaps above properly, in the order that costs least first: the double database
  read (contained to one file, nothing else to re-verify), then the type-during-fetch mismatch
  (add the field, update the fixtures it would touch), then the location-inclusion rule — the
  one that actually reaches into both gate implementations and needs a re-verified anchor.
- A loading state. The page currently shows nothing at all between navigation and the first
  response — fine on a local database, not fine on a slow connection.
- Real account scoping behind whatever auth a production deployment already has (D17 already
  names this as deliberately out of scope for the exercise, not forgotten here).
- No visual polish pass. The CSS stays intentionally plain — per the brief, unstyled-but-clear
  beats pretty-but-broken. T12's screenshots were verification evidence that every state renders correctly, not the quality bar.
- Cache `fetchWeeklyCheckData`'s five queries instead of re-running the full aggregation on
  every single request; harmless on a 20-account seed, real cost on a live, larger dataset.

## Clean-clone run

Run after commit `7fb79a6`, `git clone` into an empty directory outside this working tree, then
the four commands above in order. One deviation, both documented above: this machine's native
Postgres already holds 5432, so `DB_PORT=5433` was set for the three commands that touch it —
exactly the fallback the `Assumptions` section already names for that situation, not a change to
the commands themselves.

| Step | Real elapsed |
|---|---|
| `docker compose up -d` | 1s |
| `npm ci` (587 packages) | 13s |
| `npm run db:setup` (migration + seed) | 6s |
| `npm run dev`, until both `/api/accounts` and the Vite page answered `200` | 18s |
| working page confirmed in a real browser (Playwright, not curl) | +3s |
| **Total, `docker compose up -d` to a working page** | **~53s** |

Confirmed at `/?account=6&type=call_received&week=2026-06-01`: the flagged-up verdict (528,
Site N in the location list) actually rendered, and the browser console logged zero errors —
not just that the dev servers answered `200`.

Two caveats, so the number isn't read as colder than it is: the Postgres image (`postgres:16`)
was already pulled on this machine, so `docker compose up -d` didn't pay for that; and `npm ci`
ran against a warm local npm cache. A genuinely first-time machine adds an image pull and a real
package download on top of the ~53s above — bounded by network speed, not by anything in this
repo. The clone, its containers and its volume were torn down (`docker compose down -v`) after
the run; nothing from it was left behind.
