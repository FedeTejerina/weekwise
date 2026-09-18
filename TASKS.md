# TASKS — DASH-247

Derived from `PLAN.md` (D1–D18, §4–§12). Nothing here decides anything: where this file states
a rule, it is quoting a decision or a dated note in `PLAN.md`.

**Order.** Tasks are listed in the order they should be done; `Deps` names the exact
predecessors, so anything with the same deps can be done in either order. Each task is sized to
be finished and verified in one sitting. Ids are stable — T14, T5b and T15 sit where the work
belongs rather than where their numbers would put them, and nothing is renumbered.

**Marks.** Every task is either **load-bearing** (the output is wrong, or one of the brief's
requirements is unmet, without it) or **droppable** (the output stays correct without it; you
lose evidence, polish or a plan decision). The last section ranks the droppables in the order I
would cut them.

---

## Summary

| # | Task | Deps | Mark |
|---|---|---|---|
| T1 | Skeleton: workspace, Compose Postgres 16, TS, Vitest projects | — | load-bearing |
| T1b | README part 1: stack and assumptions | — | load-bearing |
| T2 | Migration 001, adapted from `seed/schema.sql` | T1 | load-bearing |
| T3 | Seed loader: `db:seed`, `db:setup` | T2 | load-bearing |
| T4 | Aggregation SQL: dedup, local weeks, zero-fill, as-of | T3 | load-bearing |
| T14 | SQL + timezone integration tests | T4 | load-bearing |
| T5b | Measurement harness + CDF fixture (the oracle) | T1 | load-bearing |
| T5 | Gate library (pure TS): baseline, NegBin test, usual range | T1, T5b | load-bearing |
| T7 | `weeklyCheck()` service: SQL + gate → the §6 response | T4, T5 | load-bearing |
| T15 | Regression anchor test (§12 gate anchor) | T7 | load-bearing |
| T8 | Fastify API: `/api/accounts`, `/api/weekly-check` | T7 | load-bearing |
| T9 | In-progress week line (D18) end to end | T7 | droppable\* |
| T10 | Wording layer: the §7 template | T7 | load-bearing |
| T11 | React shell + URL state (account, type, week) | T8 | load-bearing |
| T12 | Render the states | T10, T11 | load-bearing |
| T13 | Web component tests | T12 | droppable |
| T16 | README part 2: what was cut, and the clean-clone run | all shipped | load-bearing |

**Two correctness gates now sit before any UI work.** T14 pins the bucketing every number
downstream depends on, and T15 pins the gate's anchor. Both were originally scheduled after the
React work, where a wrong local week or a silently wrong baseline would have surfaced only once
the API, the wording layer and a set of screenshots had been built on it.

**T5b is the oracle, and it comes before T5.** It reproduces `PLAN.md`'s published anchor from
§4 and `seed/seed.sql` alone, so the TypeScript gate is built against a known-good reference
instead of being the only implementation there is.

The README is split on purpose: **T1b** is everything already decided in `PLAN.md`, written
before the code so the assumptions are recorded while they are still decisions; **T16** is the
two things only the end of the exercise knows — what was cut, and a verified clean-clone run.

\* T9 is droppable for *correctness* only. It implements **D18**, a settled decision, so cutting
it is a plan change and therefore your call, not mine.

---

## T1 — Skeleton: workspace, Compose Postgres 16, TS, Vitest projects

**Deps:** none · **Mark:** load-bearing

Single npm workspace with `server/` and `web/`, TypeScript everywhere, Node 22 (D14).
`compose.yaml` runs `postgres:16` with a healthcheck and a named volume. Vitest configured with
the four projects §5 names (`unit`, `sql`, `api`, `web`), the suite running under
`TZ=America/Los_Angeles`, and the `pg` `timestamp` parser pinned to UTC in a shared setup file.

**Done when**
- `docker compose up -d` reports healthy, and
  `docker compose exec -T db psql -U postgres -c 'select version()'` prints 16.x.
- `npm run typecheck` exits 0.
- `npm test` runs all four Vitest projects and passes, each with at least one placeholder test
  asserting `process.env.TZ === 'America/Los_Angeles'`.

## T1b — README part 1: stack and assumptions

**Deps:** none · **Mark:** load-bearing

Everything the README can say before a line of application code exists, because all of it is
already decided in `PLAN.md`: the stack table (§5) and why each row is there; the intended setup
and test commands, marked unverified until T16 runs them in a clean clone; the assumptions a
reviewer would otherwise mistake for bugs — no authentication, account chosen by id in the URL
(D17); "now" comes from the data, not the clock, so the page is pinned to 2026-07-27 (D7);
account 18's timezone is used as stored (D12); account 6's `2026-06-03` is treated as real
activity, not cleaned (D9); duplicates are collapsed in the query and `seed/` is never edited.
Plus the §8 paragraph on where an LLM would fit and why it isn't here.

Doing this first means the assumptions are written while they are still decisions rather than
recollections, and it puts the part a reviewer reads first outside the reach of the time cap.

**Done when** a reader who has seen **only `README.md`** — a fresh agent with no access to
`PLAN.md`, or you after a break — answers all four of these correctly and unprompted:

1. What moment is the page showing, and why isn't it today?
2. Why is the 3 June spike at account 6 left in the data rather than cleaned out?
3. Why is there no login, and how does the page know which account to show?
4. Is an LLM used anywhere in this feature, and why?

If any answer needs `PLAN.md` to be right, T1b isn't done. This tests comprehension rather than
the presence of keywords, which is the failure mode a checklist would pass.

## T2 — Migration 001, adapted from `seed/schema.sql`

**Deps:** T1 · **Mark:** load-bearing

`node-pg-migrate` 9 with plain-SQL migration files (`-j sql`). The migration carries the four
adaptations §5 lists: `CHECK` on `event_type` for the three known values,
`CHECK (duration_seconds >= 0)`, an index on `(account_id, event_type, occurred_at)`, and
**no** unique constraint across the event columns — the 12 duplicate groups must load. Its
header names `seed/schema.sql` as the source and states what was adapted (CLAUDE.md rule 3).

**Done when**
- `npm run db:migrate up && npm run db:migrate down && npm run db:migrate up` all exit 0 from an
  empty database. **This task owns that check**; T14 no longer repeats it.
- `psql -c '\d activity_events'` shows both CHECK constraints and the index, and no unique
  constraint across the event columns.
- `head -20 migrations/*_initial.sql` shows the source-and-adaptations header.

## T3 — Seed loader: `db:seed`, `db:setup`

**Deps:** T2 · **Mark:** load-bearing

A Node script that reads `seed/seed.sql` and runs it in one transaction; `db:setup` = migrate +
seed. The file is read, never written.

**Done when**
- From an empty database, `npm run db:setup` exits 0 and
  `select (select count(*) from accounts), (select count(*) from activity_events)` returns
  **20** and **12626**.
- `git status --porcelain seed/` prints nothing.

## T4 — Aggregation SQL: dedup, local weeks, zero-fill, as-of

**Deps:** T3 · **Mark:** load-bearing

The §5 query generalised: `SELECT DISTINCT` over every column but `id`; `date_trunc('week', …
AT TIME ZONE 'UTC' AT TIME ZONE a.timezone)` per account; a zero-filled week series derived from
the as-of date and the history D8 needs, not hard-coded; 4-week rolling sums; week starts
returned as `text`. As-of = `max(occurred_at)` (D7), and the default week is the latest
completed **local** week at that moment.

**Done when** `scripts/agg-check.ts` (or the T14 test) prints, against the seeded database:
- as-of `2026-07-27 22:20:34Z`, default week `2026-07-20`, 25 full weeks
  (`2026-02-02` … `2026-07-20`);
- 69 locations × 25 weeks = 1725 rows, every week present including zeros;
- post-dedup totals over those weeks: **12,517** events — **7,708** calls, **3,023** leads,
  **1,786** appointments;
- an event at `2026-06-03 02:30 UTC` for an `America/New_York` account lands on local date
  `2026-06-02`, in the week starting `2026-06-01`.

## T14 — SQL + timezone integration tests

**Deps:** T4 · **Mark:** load-bearing

**Moved here from the end of the list.** It turns T4's numbers into assertions, and a local-week
bucketing error — an `AT TIME ZONE` direction slip is the usual one — would otherwise corrupt
every number downstream, including T15's anchor and T10's verbatim sentences, before anything
failed.

Vitest against a real Postgres 16 loaded with the seed, running under `TZ=America/Los_Angeles`
(§5). T4's four bullets as assertions, plus the §12 data-handling checks: dedup totals, the New
York bucketing case, account 20, and the partial week never evaluated. The migration
`up`/`down`/`up` check belongs to T2 and is not repeated here.

**Done when** `npm test -- sql` passes, and passes again under `TZ=UTC` with identical results.

**Cheaper variant if time is short:** run against the `compose.yaml` database instead of
`@testcontainers/postgresql`. Every assertion survives; only isolation from your local data is
lost.

## T5b — Measurement harness + CDF fixture (the oracle)

**Deps:** T1 · **Mark:** load-bearing

`PLAN.md` §12 says a changed count is "re-measured, not adjusted by hand", but nothing in the
repo could re-measure anything: the scripts that produced every anchor number
(`estimators2.py`, `per_type.py`, and I2/I3's `erratum.py`, `sites.py`, `siten.py`) lived only
in ephemeral session scratch directories, and `per_type.py` still implements the **pre-E9
median** baseline, so it is not even the instrument that produced the D8 figures. This task
ports the D8 trim path into the repo as a committed, independent second implementation.

- `scripts/measure-anchor.py`, run with `uv run --with scipy,numpy,tzdata`, applies D8 and the
  §4 gate and prints the whole anchor.
- `scripts/gen-nbinom-fixture.py` writes the committed JSON fixture of T3-shaped cases,
  including non-integer `r`, that T5 tests against. **This absorbs the old T6**, which is no
  longer a separate task and no longer on the cut list: one `scripts/` directory and one scipy
  invocation now produce both the anchor and the fixture, and §12 lists the scipy agreement as a
  check the implementation must pass.
- `scripts/expected-anchor.json`, the harness's own output, committed so a drift is a diff.

**It parses `seed/seed.sql` directly and never touches Postgres.** That is the point: if it
queried the database through the app's own aggregation SQL it would inherit T4's bugs, and the
cross-check would be blind to exactly the failure it exists to catch. It therefore depends on T1
alone, not on T3 or T4.

**Done when** `uv run --with scipy,numpy,tzdata scripts/measure-anchor.py` reproduces, from §4
and the seed alone with no reference to the TypeScript:
- 12,614 events after deduplication; 12,517 in the 25 full weeks, split 7,708 / 3,023 / 1,786;
- account 6 calls `2026-06-01` → 528, typical 43.9, usual [31, 58], 12.03×;
- account 7 calls `2026-07-13` → 3, typical 11.1, usual [5, 18];
- account 1 calls `2026-07-20` → 34, usual [20, 42], quiet;
- 15/15 account-6 locations flagged up on `2026-06-01`, and 0 echo drops on all three types;
- location flags excluding account 6: **4 / 4 / 9** at gate level, **4 / 3 / 9** renderable;
- verdict flags: **10 / 5 / 3** of 246, excluding only account 6's `2026-06-01` cell.

## T5 — Gate library (pure TS): baseline, NegBin test, usual range

**Deps:** T1, T5b · **Mark:** load-bearing

Pure functions, no database, exactly as §4 specifies: trimmed-mean baseline over the 12
preceding full weeks (drop highest and lowest, average the remaining 10, D8); minimum history 16
weeks for locations, 13 for the account; `NegBin(r = 10·m, p = 10/(10+w))`; `DOWN` if
`CDF(x) < α`, `UP` if `1 − CDF(x−1) < α`; `α = 0.05/(2k)`; `m` floored at 0.1. Three states
only: flagged, quiet, not enough history. CDF from
`@stdlib/stats-base-dists-negative-binomial-cdf`.

**The usual range**, stated operationally because §4's original phrasing was off by one (see its
erratum note, log I7): `lo` is the smallest count with `CDF(lo) ≥ α`, and `hi` is the largest
count with `1 − CDF(hi − 1) ≥ α` — the largest count the gate leaves quiet. Coding the old
sentence literally gives `[31, 57]` where §7 and §12 publish `[31, 58]`, and one-too-low upper
bounds everywhere else.

**Trimming ties:** drop exactly one highest and one lowest week, never the same week twice —
i.e. `sorted(weeks)[1:-1]`, which is what T5b's harness does.

**Done when** `npm test -- unit` passes with tests that pin:
- the trimmed mean drops exactly one high and one low week, and ties don't drop the same week
  twice;
- 15 weeks of location history → `not_enough_history`, 16 → evaluated; 12 → not enough for the
  account verdict, 13 → evaluated;
- the floor: `m = 0` yields `r = 1`, no `NaN`, no throw;
- `usualRange` is self-consistent — brute-forcing `x` over a handful of `(m, w, k)` shows every
  count inside the range comes back quiet and both counts just outside it come back flagged.
  **This is the clause that catches the off-by-one above**, so it must brute-force against the
  gate rather than recompute the range formula;
- α halves per side and divides by `k`: one constructed case flags at `k = 1` and is quiet at
  `k = 15`;
- agreement with T5b's committed scipy fixture: max relative error < 1e-10 across every row
  (E7 measured `@stdlib` at 3.2e-14, so the threshold is a safety margin, not a target);
- **a constructed fixture** in which a location has 15 weeks of history and comes back
  `not_enough_history` rather than quiet. The seed cannot produce this state (log I3), so it
  exists nowhere else.

## T7 — `weeklyCheck()` service: SQL + gate → the §6 response

**Deps:** T4, T5 · **Mark:** load-bearing

One function taking `(accountId, eventType, weekStart)` and returning the §6 object: `asOf`,
`week`, `weeks`, `account`, `verdict`, and `locations` — the last **omitted entirely** for
single-site accounts (D16), with `flagged`, `notEnoughHistory` (by name) and `quietCount`.
`changePct` present **only** when flagged (D11). Account verdict = same gate with `w = 1`,
`k = 1` (D10); locations `w = 4`, `k = location count` (D3, D4).

Single-site accounts in the seed are **8, 13, 16 and 19**; multi-site are 1, 2, 3, 4, 5, 6, 7,
9, 10, 11, 12, 14, 15, 17 and 18.

**Done when** `npx tsx scripts/check.ts <account> <type> <week>` prints:
- account 6 / `call_received` / `2026-06-01` → `flagged_up`, `count = 528`, `typical = 43.9`,
  `usualRange = [31, 58]`, `changePct = 1103`, and `notEnoughHistory: []`;
- account 1 / `call_received` / `2026-07-20` → `quiet`, `count = 34`, `usualRange = [20, 42]`,
  and **no** `changePct` key;
- account 7 / `call_received` / `2026-07-13` → `flagged_down`, `count = 3`,
  `usualRange = [5, 18]`;
- account 12 / `call_received` / `2026-06-29` → `flagged_up`, `count = 45`,
  `usualRange = [20, 43]` — the under-2× case §7 gained in log I7;
- account 15 / `lead_created` / `2026-05-25` → `flagged_down`, `count = 0`,
  `usualRange = [1, 9]` — the drop-to-zero case;
- account 20 → `not_enough_history`, no thrown error;
- accounts 16 and 19 (single site) → no `locations` key at all.

## T15 — Regression anchor test (§12 gate anchor)

**Deps:** T7 · **Mark:** load-bearing

**Moved here from second-to-last, and its dependency on T14 dropped** — it needs T7 and a seeded
database, nothing else. This is the only check that catches a silently wrong baseline, and D8's
history shows the baseline is where this design goes wrong quietly rather than loudly, so it
runs before the API, the wording layer and the React work are built on its numbers.

Evaluates every account and location across weeks `2026-05-18` … `2026-07-20` for all three
event types and asserts the E9 anchor. **Both exclusions are stated explicitly**, because §4
described them wrongly until log I7's erratum and the anchor is unreproducible without them.

**Done when** `npm test -- sql` includes a test asserting:
- 15/15 account-6 locations flagged up for calls on `2026-06-01` — computed on the **804**
  deduplicated events of 2026-06-03, not the 805 raw rows;
- **0** account-6 location drop flags in the weeks after the spike leaves the window (the echo
  check), on all three event types;
- **location flags excluding account 6, at gate level: 4 / 4 / 9** for calls / leads /
  appointments, counting **every** non-account-6 location, including those in single-site
  accounts;
- **location flags excluding account 6, renderable only: 4 / 3 / 9**, counting multi-site
  accounts alone. The difference is exactly one row — **account 19, Site A, week of 2026-05-18,
  13 leads against a typical 1.4, k = 1** — which D16 suppresses because account 19 is single
  site. Asserting both numbers makes that suppression a tested behaviour rather than an
  accident;
- **verdict flags: 10 / 5 / 3 out of 246**, excluding **only account 6's `2026-06-01` cell** and
  not the rest of account 6. Excluding all of account 6 gives 7 / 4 / 3 and is wrong; 246 is
  19 accounts × 13 weeks − that one cell.

If a count differs, the test fails and the number is **re-measured with T5b, not adjusted by
hand** (§12).

## T8 — Fastify API: `/api/accounts`, `/api/weekly-check`

**Deps:** T7 · **Mark:** load-bearing

Fastify 5, typed routes with schema validation. `GET /api/accounts` → id, name, timezone,
location count. `GET /api/weekly-check?account=&type=&week=` → T7's object. Invalid or
out-of-range parameters fall back to the defaults (first account, `call_received`, D7's latest
completed week) rather than erroring (D15).

**Done when**
- `npm test -- api` passes, covering via `app.inject()`: the four verdict states, the
  single-site omission, account 20, and `?account=999&type=nonsense&week=1999-01-01` returning
  200 with the defaults applied;
- `GET /api/accounts` returns all 20 accounts with a location count, and account 20 appears with
  a count of 0 rather than being omitted;
- `curl 'localhost:3000/api/weekly-check?account=6&type=call_received&week=2026-06-01'` returns
  the flagged-up body against a running server.

## T9 — In-progress week line (D18) end to end

**Deps:** T7 · **Mark:** **droppable\***

`inProgress { weekStart, daysIn, count }`: the selected event type from the start of the
account's current local week to the as-of moment, deduplicated like everything else; `daysIn` is
the day number within the week; `null` when as-of falls exactly on a boundary. Never compared,
never baselined, never part of a window.

**Done when**
- account 6 → `{ weekStart: "2026-07-27", daysIn: 1, count: 7 }`; accounts 5 and 12 → 6;
  account 1 → 3; accounts 2, 8 and 20 → 0;
- a test asserts the `2026-07-20` verdict object is **deep-equal** with `inProgress` computed and
  with it stubbed out.

\* Droppable for correctness only — by construction it cannot move a verdict. But it is **D18**,
which you added in E10 for a reason the arithmetic doesn't see (the page reading stale on a
Wednesday), so cutting it is your call.

## T10 — Wording layer: the §7 template

**Deps:** T7 · **Mark:** load-bearing

Pure functions from the §6 response to the §7 sentences: the six account states, the two
location states, the locations-quiet line, and the in-progress line if T9 ships. Includes the
`explain(verdict, facts) -> string` seam (§8), whose only implementation is this template.

**The three rules §7 didn't state**, now settled — the size rule is §7's addition note (log I7),
the other two are this task's:

1. **Size.** A ratio of **2× or more** reads as a multiple ("about 12×"); below that, as a
   percentage above or below ("about 45% above", "about 73% below"); a count of **zero** reads
   as "no X at all", with the usual range and **no percentage**.
2. **Dates.** `en-GB`, no year: `20–26 July`, `1–7 June`, `29 June – 5 July`, `Mon 27 July`.
   Ranges use an en dash, and a range spanning two months names both.
3. **Return shape.** The layer returns **structured parts**, `{ text, emphasis: [ranges] }`, not
   a markdown string. T10 asserts the parts; T12 renders `<strong>`. Nothing parses markdown at
   runtime. This is the T10 → T12 interface, so it is fixed here rather than discovered at T12.

Plus the standing rules: the usual range is always shown; a percentage appears only when flagged
(D11); zero is written "no calls yet" on the in-progress line; same numbers in, same sentence
out.

**Done when** `npm test -- unit` reproduces these six §7 sentences **verbatim**, including
emphasis ranges and date formatting:
- account 1 calls `2026-07-20` — quiet, 34, usual 20–42, no percentage;
- account 6 calls `2026-06-01` — up, 528, usual 31–58, "about 12×";
- account 7 calls `2026-07-13` — down, 3, usual 5–18, "about 73% below";
- account 12 calls `2026-06-29` — up, 45, usual 20–43, "about 45% above" (the under-2× case);
- account 15 leads `2026-05-25` — down, 0, usual 1–9, "no leads at all", no percentage;
- account 6 Site N calls, 4 weeks to `2026-06-07` — up, 40, usual 2–24.

Plus the not-enough-history sentence and the location list-by-name line, both from the
constructed fixture T5 builds — the seed cannot produce them (log I3).

**Droppable sub-item:** the `explain()` seam itself. §8 argues the boundary is worth specifying
rather than building; if time is short the template is called directly and the README paragraph
carries the argument.

## T11 — React shell + URL state

**Deps:** T8 · **Mark:** load-bearing

React + Vite + TypeScript, one page, plain `fetch`, no state library. Account, event type and
week live in the URL (D15); the account picker is fed by `GET /api/accounts`, and the week
control moves backwards through `weeks`. Invalid values fall back to defaults and the URL is
rewritten.

**Done when**, with the app running:
- selecting account 6 / `call_received` / `2026-06-01` gives URL
  `/?account=6&type=call_received&week=2026-06-01`; a full reload restores all three; browser
  back returns to the previous selection;
- the account picker lists all 20 accounts by name, and the week control offers only weeks from
  the response's `weeks` array, none later than `2026-07-20`;
- `/?account=abc&type=&week=2026-13-99` renders the default view and rewrites the URL, with no
  error page and nothing logged to the console.

## T12 — Render the states

**Deps:** T10, T11 · **Mark:** load-bearing

The §7 page: verdict and usual range on top, the in-progress line above it (if T9 ships),
locations below shown **only** when flagged, otherwise the single "nothing unusual at any of
your N locations" line, with not-enough-history locations listed by name. No location section at
all for single-site accounts (D16). A quiet verdict shows no percentage (D11). Emphasis is
rendered from T10's `emphasis` ranges.

**Done when**, checked in a browser and captured as five screenshots:
- account 6, `2026-06-01`, calls → flagged up, 528, usual 31–58, "about 12×", Site N in the
  location list;
- account 1, `2026-07-20`, calls → quiet, 34, usual 20–42, no `%` anywhere on the page, and the
  "nothing unusual" locations line;
- account 15, `2026-05-25`, leads → "no leads at all", usual 1–9, and no percentage;
- account 19 → no location section rendered at all, even though the gate flags its Site A for
  leads in the week of `2026-05-18`. This is D16's suppression, made visible;
- account 20 → "Not enough history yet…" and no crash.

## T13 — Web component tests

**Deps:** T12 · **Mark:** **droppable**

Vitest + Testing Library + jsdom over the rendered states.

**Done when** `npm test -- web` passes with a test per state, including an assertion that no `%`
appears in a quiet render, that the drop-to-zero render has no percentage either, and that the
location section is absent for a single-site account.

**Why droppable:** T12's screenshots already evidence the same behaviour once. These tests buy
repeatability, which a 4–6h exercise may not need.

## T16 — README part 2: what was cut, and the clean-clone run

**Deps:** everything that shipped · **Mark:** load-bearing

Written last, because it can only be written last. Two things T1b cannot know: **what was
actually cut** and why — the entries from the cut list below that were taken, stated plainly so
a reviewer isn't left inferring absence from silence — and the verified setup path: the four
commands as actually run, the one-line test note including that Docker must be running, and the
elapsed time of a clean-clone run.

**Done when**
- a clean clone into a fresh directory, following only the README, reaches a working page at
  `/?account=6&type=call_received&week=2026-06-01`, and the elapsed time is recorded (target
  about 15 minutes, dominated by the image pull and `npm install`);
- every command the README lists has been run in that clone, in that order, with nothing
  implicit;
- the "what I cut" section names each dropped item and what evidence went with it, and matches
  what is actually absent from the repo.

---

## What I would cut, in order

Cut from the top. The first two cost nothing but evidence.

| order | cut | what it costs |
|---|---|---|
| 1 | **T13** — web component tests | Repeatability of a check T12's screenshots make once. |
| 2 | **T10's `explain()` seam** | Nothing functional; §8's argument already stands in prose. |
| 3 | **T14 → compose instead of testcontainers** | Test isolation from your local database; every assertion survives. |
| 4 | **T11's week control**, default week only | The ability to look at a past week. It also takes T12's account-6 demo path with it, since that needs `week=2026-06-01`, so this only works if the demo becomes a fixed screenshot. |
| 5 | **T9** — the in-progress line | D18. Correctness untouched; the page reads stale mid-week, which is exactly the failure E10 identified. **Your call, not mine.** |

**The old T6 has left this list.** It is folded into T5b and load-bearing: §12 lists the scipy
agreement as a check the implementation must pass, and the fixture now costs one extra script in
a `scripts/` directory that has to exist anyway.

Whatever is taken from this list is named in T16's README section. A cut that is written down is
a judgment; a cut that is silent is a hole, and the reviewer cannot tell which one they are
looking at.

**What I would not cut, and why:** T4, T5b, T5, T7, T14 and T15 — the two correctness gates and
everything they test. T15 in particular looks like "just a test", but it is the only thing that
catches a silently wrong baseline, and T5b is the only thing that can re-measure it when it
moves.
