# Planning log — reading the problem

Appended as the session runs. Entries are never rewritten, merged or tidied afterwards; where I
was the one who got it wrong, the entry stays as it happened.

**Started:** 2026-09-17
**Closed:** 2026-09-17
**Models:** Claude Code, Opus 5, throughout.
**Language:** prompts are in English, exactly as typed. Nothing here is translated or reworded.

Who writes which half of an entry is in [`README.md`](README.md), along with the reflection.

### Why the prompts look like this

In the planning phase I direct by constraining and challenging rather than by writing long
specifications: short adversarial questions, explicit constraints, and demands for a self-audit
against them. That's deliberate — a long spec up front just gets me a confident answer to a
question I hadn't finished thinking about.

Detailed, spec-shaped prompting starts once there are tasks to implement, which is where it
earns its keep.

---

## E1 — First read of DASH-247: what's asked, what's open, what to know first

**Me:**
> I'm picking up a take-home exercise. Here's the ticket and the product background it came with:
>
> TICKET:
> DASH-247 — Help customers understand whether their recent activity is normal
> Customers looking at their dashboard can't tell whether this week's numbers are good, bad, or typical for them. Product wants the dashboard to help a customer answer "is this normal for us?" at a glance, without exporting data or calling their account manager.
>
> Notes from product:
>
> probably involves comparing against some baseline
> multi-location customers matter
> a customer admin should be able to look at this Monday morning and act on it
> Out of scope per product: alerting/notifications, ML/forecasting.
>
> PRODUCT BACKGROUND:
> Relay — Product Background
> Relay is a B2B SaaS that helps service businesses track inbound customer activity — calls, leads, appointments — across their locations. Customers range from single-site shops to groups with 15+ locations.
>
> Each customer gets a reporting dashboard. Today it shows raw totals per location and not much else.
>
> Two things the team keeps hearing:
>
> Account managers say customers ask "is this number normal for us?" and can't answer it from the dashboard.
> The support team says customers with multiple locations struggle to spot which location needs attention.
> How the team works
> The engineering team works spec-driven and AI-first: engineers pick up tickets like the one in TICKET.md, build an AI-assisted implementation plan, and implement with AI coding agents by default. Judgment concentrates on planning, spec interpretation, and reviewing/hardening agent output.
>
> Data model
> Two tables (see schema.sql):
>
> accounts — one row per customer. Includes the account's IANA timezone.
> activity_events — inbound activity: call_received, lead_created, appointment_set. Each event has a location (the account's site/branch), an occurred_at timestamp in UTC, an optional duration_seconds (calls), and an optional outcome.
>
> Before anything else: don't propose a solution, a stack or an architecture yet — I'll ask when
> I want one. For now, read it and tell me what you make of it. What's actually being asked,
> what's deliberately left open, and what you'd want to know before deciding anything.

**Agent:** Read the repo (CLAUDE.md, schema, seed header, settings). Loaded `seed/seed.sql`
read-only into a throwaway SQLite DB in the session scratchpad (outside the repo) and profiled it,
so the reading of the ticket would rest on the data rather than on assumptions. No solution,
stack or architecture proposed.

Reading of the ask: the real question is "is this normal *for us*", which needs a
per-customer (and per-location) reference point, and "which location needs attention", which is
a ranking/triage question rather than a totals question. The "Monday morning, act on it" note
makes the unit a completed week in the account's own timezone, and makes the output a
decision aid, not a report.

Left open, as the agent read it: what "normal" means (the baseline and how much deviation
counts); which metrics count (raw volume, or rates like missed calls, conversion and no-shows);
what "this week" means; how deviations are shown; what counts as "acting on it"; how locations
are compared (against their own history or against sibling locations).

Data facts surfaced (queries were run in the scratch DB; profiling script is in the session transcript):
- 20 accounts, 12,626 events, 2026-02-01 → 2026-07-27 UTC (~25 full weeks, partial at both
  edges). Today is 2026-09-17, so the wall-clock "this week" has no data.
- Account 20 (Quiet Harbor Spa) has zero events.
- Location counts per account: 1 to 15 (account 6 has 15).
- 12 groups of exact duplicates (24 rows), identical in every column except `id`.
- Nulls: 398 events with no outcome; 313 calls with no duration. Duration appears only on
  calls, range 20–1500s, with no obvious outliers there.
- Weekly volume per location is low (medians of about 4–10 events per week), so ordinary
  week-to-week noise is large relative to the signal.
- Account 6: every one of its 15 locations spikes about 10–15× in the same week (the week
  starting 2026-06-01, UTC `%W` week 22), so the cause is account-wide. The cause is unverified.
- Scattered single-location spikes of 2–3× and dips to 0–3 at other accounts.
- Account 18 has timezone `UTC`, but its hourly distribution peaks 12:00–19:00 UTC, which looks
  like US business hours, so its timezone may be a placeholder. This is an inference, unverified.

Questions it raised before deciding anything: who is the admin and what action do they take;
which metrics matter per industry; what a week is; what the baseline is and how to handle
thin history and new accounts; how to treat the account-wide spike; the "now" problem, since
the data ends in July; what "at a glance" has to fit on; and whether the answer should be
honest about low volume ("not enough signal") instead of forcing a verdict.

Repo changes: this log entry only.

**My call:** accepted — it went to the data before interpreting the ticket, which is the right
order, and it marked its own inferences as unverified without me asking.

**Who was right:** (no disagreement yet)

## E2 — Challenge: are the "single-location spikes" in E1 just the noise E1 described?

**Me:**
> I'll get to the questions, but first, you can push a bit harder on the data itself to answer most of them. You said volume per location is low and that noise is big compared to the signal. Then you listed single-location spkies and dips as findings, those two aren't adding up for me. How do I know those spikes aren't just the noise you described? Find a way to test it and show me the queries you used

**Agent:** Agreed that E1 contradicted itself. E1 flagged location-weeks with a crude rule
(n = 0, n > 2×median, or n < 0.4×median) over UTC `%W` weeks, and never checked that rule
against chance. Tested it in the scratch SQLite DB with a Python script
(`scratchpad/noise_test.py`, outside the repo; SQL shown in the chat reply):

- Built weekly counts per location with exact duplicates removed, account-local Monday weeks
  (zoneinfo UDF), only the 25 full weeks 2026-02-02..2026-07-20, and weeks with no events
  filled in as 0. That gives 69 locations × 25 weeks = 1,725 cells and 12,517 events.
- **Test 1, dispersion (var/mean):** median 1.13; 15 of 69 locations overdispersed at p<0.01
  (about 0.7 expected by chance).
- **Test 2, leave-one-out Poisson tails** (baseline = median of the location's other weeks):
  at p<0.05 there are 96 spikes and 54 dips against 86 expected per side, which is noise level.
  At the Bonferroni threshold (0.05/1725) only 15 cells survive: all 15 are account 6's
  locations in the week of 2026-06-01, at 8–17× baseline. **No dip survives at any threshold
  below 0.001.**
- **Test 3:** E1's crude rule flags 111 cells in the real data. Applied to pure Poisson data at
  the same rates, it flags 102 on average (95% range 81–124). So E1's single-location
  "findings" were indistinguishable from noise.
- **Test 4:** with the 15 account-6 cells removed, median dispersion is 0.97 and 0 of 69
  locations are overdispersed. What remains is consistent with pure Poisson noise.
- **Detectability:** at the Bonferroni threshold, one location-week needs a swing of about 2.6×
  (baseline 10) to 3.8× (baseline 4) to count as a spike. A week with zero events is never
  significant at baselines of 4–10, so dips can't be detected at location-week level.
- **Account 6 detail:** the spike is a single day. 2026-06-03 has 805 events against about 15
  on a normal day. The event_type/outcome mix matches the rest of the year, and the events are
  spread over normal daytime hours. The burst is bounded by the UTC calendar day: it runs from
  04:00 to 23:59 UTC and drops to 0 right after midnight UTC, although this account normally
  has activity at 00–03 UTC. That points to something keyed on a UTC date (a batch or import).
  Unverified.
- Retracts E1's "scattered single-location spikes and dips" finding; E1 is left as written.

Repo changes: this log entry only.

**My call:** redirected — I pointed at the contradiction and asked it to test it, without
telling it which test to use.

**Who was right:** me - its E1 rule flagged the same amount on real data as on pure noise.

## E3 — Does "each location's movement as a bar, sized by change" survive the noise finding?

**Me:**
> You just told me that the drops can't be detected at location level. I was planning to show each location's movement and let the bar size do the work. Does that still make sense, or am I drawing attention to noise?

**Agent:** Said the plan, as described, would mostly draw attention to noise, and backed that
with data (scratch DB; `scratchpad/bars_test.py` plus an inline outcome-rate query; SQL shown
in the chat reply). Did not propose a replacement design; listed the decisions the plan
depends on instead.

Self-correction to E2: E2 applied a Bonferroni correction over all 1,725 location-weeks, which
is stricter than the view of one admin looking at one account. E3 redoes detectability with
alpha = 0.05 / (number of locations the admin looks at).

Account 6's spike week was excluded from all of the following.
- **A/B, size of the bars:** measured against each location's own median, 27% of ordinary
  location-weeks move by ≥50% (simulated pure Poisson: 25%). Week over week, 41% move by
  ≥50% (Poisson: 41%). The p10–p90 range is −50%..+60% (Poisson: −50%..+50%).
- **C, persistence:** a location's deviation this week does not predict its deviation next
  week. Mean Spearman rho is −0.046 (sd 0.47) over 167 account-week pairs, in accounts with
  ≥4 locations. The location with the biggest bar changes from week to week at random.
- **D, the biggest bar per account-week:** of 374 multi-location account-weeks, it is
  significant (at alpha 0.05/k) in 8 as a drop and 23 as a spike. Per-account-week Bonferroni
  allows up to about 19 false alarms per side (5% of 374), so these counts are at roughly
  chance level.
- **E, detectability at the admin's scope:**
  - With one week at 4 events/week and 5+ locations, no drop is detectable, not even a week
    with zero events.
  - With a 4-week window, drops of about 40–70% become detectable, depending on rate and
    number of locations.
- **F, level differences between locations:** within each account, location totals do not
  differ (chi-square p from 0.053 to 0.98, across 15 multi-location accounts).
- **Outcome rates:** the shares of missed calls, no-shows and converted leads do not differ
  across locations within any account (minimum p 0.0053, against a 0.0011 threshold). The
  missed-call share does not change between Feb–Apr and Apr–Jul in any location (Bonferroni
  over 69). Known flaw: the H1 denominator counted calls with a null outcome, which slightly
  dilutes H1. Not re-run.
- Conclusion given: apart from account 6's single day, the seed data shows no location-level
  signal in volume or in outcome rates. The noise floor comes from the volume and would apply
  to real data too. "No real differences between locations" may be specific to this dataset.
  Not tested: week-level changes in outcome rates, and call duration.

Repo changes: this log entry only.

**My call:** accepted — it told me my planned design doesn't hold and backed it with numbers,
and it corrected its own over-strict threshold from E2 at the same time.

**Who was right:** the agent — I had planned bars sized by movement, it proved they'd show
noise.

## E4 — Decisions on the location view; what a 4-week window changes in the aggregation

**Me:**
> The bar IS the raw change, not whether it beats noise.
> This works only if the window is big enough for a raw change to mean something, so the movement goes to a 4 week window, and the account verdict stays weekly.
> Agree on the third one, the quiet state is the main output of this product, not the edge case.
>
> Now tell me how moving the location view to 4 weeks actually changes in the aggregation. Then I can answer the first questions and move on with the PLAN

**Agent:** Measured the 4-week window in the scratch DB (`scratchpad/window4_test.py`; SQL shown
in the chat reply) and described the aggregation consequences without picking among them.
Pushed back on one premise: on this data, 4 weeks shrinks the noise but does not make a raw
change meaningful by itself.

Windows touching account 6's spike were excluded; the pure Poisson simulation used each
location's median rate. Share of bars moving by ≥25% / ≥50%:
- Last 4 weeks vs the previous 4, rolling weekly: 37% / 8%. Pure Poisson: 38% / 10%.
  p10–p90 is −30%..+43%.
- Same comparison, on non-overlapping 4-week blocks: 39% / 10%.
- Last 4 weeks vs the previous 12, scaled to 4 weeks: 25% / 4%. Pure Poisson: 28% / 4%.
  p10–p90 is −23%..+34%.
- For reference, 1-week bars in E3: 27% of cells ≥50% against the location's median, and 41%
  week over week.

What else changes:
- **Overlap:** rolling windows share 3 of 4 weeks, so bars correlate across weeks. A bar's
  correlation with its value 1 week later is +0.61; this is an artifact of the shared weeks,
  not of real change. After 4 weeks it is −0.51, an echo effect: a high window becomes the
  comparison window, so the sign flips. After 8 weeks it is +0.02.
- **Outliers persist:** account 6, Site N shows about +320% to +470% for 4 weeks after the
  spike day. Compared with the previous 4 weeks, it then shows about −80% for 4 weeks.
  Compared with the previous 12 weeks, it shows about −56% to −66% for up to 12 weeks (the
  data ends after 4 of them).
- **History needed:** 8 weeks (first bar 2026-03-23) with the previous-4 comparison; 16 weeks
  (first bar 2026-05-18) with the previous-12 comparison.
- **Zero-filled weeks become mandatory:** `ROWS` windows count rows, not calendar weeks.
- **Split by event type:** median counts per 4 weeks are about 18 calls, 7 leads and 4
  appointments, so per-type 4-week bars are about as noisy as 1-week totals. Known flaw: this
  query included account 6's spike day and used UTC date bounds, which inflates account 6's
  15 locations.
- **Disagreement with the weekly verdict:** the weekly verdict and the 4-week bars can
  disagree. A spike shows in the verdict for 1 week but in the bars for 4 to 16 weeks.
- **Tension with "the quiet state is the main output"** (arithmetic that assumes locations
  are independent): with 8–10% of bars at ≥50% from noise, a 15-location account shows at
  least one such bar on about 71–79% of Mondays (about 46% with the previous-12 comparison).
- **DST:** local 4-week windows are always 28 local days; a window spanning a DST change has
  671 or 673 hours, which is negligible.

Repo changes: this log entry only.

**My call:** redirected — I handed it three decisions, it took two and pushed back on the
premise of the third with measurements.

**Who was right:** the agent — the 4-week window doesn't rescue the bars. A 15-location
account would still show a big bar on about 75% of Mondays from noise alone.

## E5 — Significance gate instead of bars; first draft of PLAN.md

**Me:**
> Ok,, so what do you think about going with significance gate at location level instead of using bars? I think that may answer most of your open questions. In the meantime let's start writing PLAN.md with what we have so far.

**Agent:** Ran the gate on the seed before giving an opinion (`scratchpad/gate_test.py`).
The gate tested: 4-week location total against the prior 12 weeks, two-sided Poisson,
alpha = 0.05/k per account-week, evaluated every Monday from week 16 (690 evaluations).

- **Median-based baseline:** 85 flags, 61 of them account 6's spike (all 15 locations, UP,
  2026-06-01..06-29). The other 24 are spread across 12 accounts, at about noise rate, and
  repeat on consecutive Mondays because the windows overlap (account 18: 5 flags on
  3 locations).
- **Mean-based baseline:** 122 flags, including **36 false DOWN flags in account 6**
  (11 locations, 2026-06-29..07-20), an echo of the spike. So a robust baseline is required.
- **Weekly account total** against the median of the prior 12 weeks (alpha 0.05):
  - detectable change ranges from about ±25% (account 6, 76 events/week) to −86%/+100%
    (account 16, 7 events/week);
  - there were about 22 flags besides account 6's spike week, against roughly 12 expected by
    chance. Possible cause: the test treats the 12-week baseline as exact. Unverified.
- **Correction in the same turn:** the script printed "at most ~2.6 false flags/year per
  account", but that assumed a one-sided test. At alpha/k per side, up to about 10% of
  account-Mondays can show a false flag.

Opinion given: the gate fits D1 (quiet state) better than raw bars, and it answers the
quiet-state question (6), most of the comparison question (7: own history) and the history
requirement (4: 16 weeks).

Wrote `PLAN.md`: problem reading, data constraints, decisions D1–D4, rules derived from the data,
open decisions O1–O11 with the agent's recommendations marked as such, out of scope, and
behavioural checks against the seed. D4 (the gate) was written in as decided on the strength of
this prompt and flagged "strike if not". No stack or architecture proposed (O11 left open).

Repo changes: new `PLAN.md`; this log entry.

**My call:** accepted — it ran the gate on the seed before giving an opinion, and left D4
marked "strike if not" instead of treating my proposal as settled.

**Who was right:** (not a disagreement)

## E6 — Rule 1 retired; open decisions closed; O6 threshold options; O11 stack

**Me:**
> Rule 1 in CLAUDE.md is retired, we're past discovery, I want you to converge now.
> Update CLAUDE.md to say that and note why.
>
> On the open decisions: I accept your recommendations and I want to add the answer the other open questions:
> O1: the admin is a customer admin doing a Monday check, On a normal week the action is "nothing to do", and that's the point since today they are calling their account manager to ask if 51 calls per week is fine.
> O6: you can give me two or three concrete threshold options with what each does to flag counts on this seed, and your recommendation.
> O10: after O6.
> O11: give me your best stack option.

**Agent:**
- **CLAUDE.md:** rule 1 is struck through and marked retired 2026-09-17, with the original
  rule, why it existed, why it's retired, and what replaces it (propose options, recommend,
  converge; anything contradicting PLAN.md still needs the user's call). The heading "Three
  hard rules" became "Hard rules".
- **PLAN.md:**
  - The accepted recommendations became D6–D12 (O2–O5, O7–O9), and the O1 answer became D5.
  - D4 is no longer marked "strike if not".
  - O10 is left open and marked as waiting for O6.
- **Environment:** checked the local toolchain. Docker and psql are missing; Node 22, uv and
  Python 3.10 are present.
- **O6:** measured three options with `scratchpad/thresholds.py`, using the median baseline of
  the prior 12 weeks throughout:
  - **T1:** Poisson, familywise 5% (0.05/2k per side);
  - **T2:** Poisson, familywise 1%;
  - **T3:** negative binomial predictive `nbinom(12·median, 12/(12+window))`, familywise 5%.

  On the seed, with account 6 excluded (E5's run shown for reference):

  | | location flags (streaks) | account-Mondays with a flag | account verdict flags |
  |---|---|---|---|
  | E5 | 24 (20) | 12% | 22/246 |
  | T1 | 14 (11) | 8% | 16/246 |
  | T2 | 3 (2) | 2% | 6/246 |
  | T3 | 4 (3) | 2% | 14/246 |

  All options flag 15/15 of account 6's locations on 2026-06-01 and give 0 false drop flags
  after the spike.

  On pure noise (400 runs), share of account-Mondays with a location flag / account verdict
  flagged:
  - T1: 12.8% / 4.9%
  - T2: 4.4% / 1.2%
  - T3: 6.1% / 4.4%

  So T1 and T2 fire about 2.5× and 4× their nominal rate at location level, because they
  treat the baseline as exact.

  Power (2,000 runs):

  | | loc 6/wk, 5 locs, −50% for 4 wks | same, −30% | loc 10/wk, 15 locs, −50% | account 30/wk, −40% for 1 wk | account 50/wk, −30% for 1 wk |
  |---|---|---|---|---|---|
  | T1 | 46% | 12% | 62% | 61% | 58% |
  | T2 | 27% | 6% | 44% | 35% | 32% |
  | T3 | 34% | 7% | 50% | 57% | 54% |

  Recommended T3: calibrated, quiet at location level, sensitive at account level. The cost
  stated: a sustained −50% location drop is caught about one time in three. No suppression of
  repeat flags proposed.
- **O11:** recommended PostgreSQL 16, numbered plain-SQL migrations with a small runner,
  Python 3.12 via uv, FastAPI, psycopg 3, scipy, server-rendered Jinja2, and pytest (unit tests
  for the gate; integration tests on a seeded Postgres implementing PLAN §6).
  - SQL does deduplication, local weeks, zero-fill and window sums; Python does the gate and
    the wording.
  - Prerequisite flagged: install Docker Desktop or a native Postgres (user's call). It is
    unverified that `seed.sql` loads unchanged.
  - Rejected SQLite (no timezone support), DuckDB (not a serving database) and Node (weaker
    statistics library).
- **Tension raised in chat, not written into PLAN:** the O1 example is "51 **calls** per
  week", but D6 gates total volume across all event types.

Repo changes: `CLAUDE.md` (rule 1 retired), `PLAN.md` (D5–D12, O6 options, O11 proposal); this
log entry.

**My call:** rejected the stack, accepted the rest. Its stack proposal optimised for the
statistics library and ignored that the brief asks me to build in my strongest stack —
that one is on my prompt, I asked for its "best option" without giving it the constraint.

**Who was right:** me on the stack, the agent on the event-type tension it raised.

## E7 — T3 chosen; stack moved to React + Node, Postgres 16 in Compose, Vitest

**Me:**
> About O6 I agree, let's go with T3.
> About O11: Nice stack ideas. However, the take-home exercise asks me to handle it in my strongest stack, I usually work with React + Node, can we accommodate the stack to those technologies? for the database Postgres 16 is definitely the way to go and I'd like to keep it, probably in docker-compose which is fine here, it's already installed in this machine, you can double-check. Moreover, adding tests is critical, so I'd suggest Vitest, what do you think?

**Agent:**
- **Docker:** E6 said Docker was missing; that was wrong. Docker 29.8.0 and Compose v5.5.1 are
  installed at `C:\Program Files\Docker\Docker\resources\bin`, and the daemon is running.
- **Seed verified in Postgres** (throwaway container `postgres:16`, 16.15, with `seed/` mounted
  read-only; the container was removed afterwards):
  - `schema.sql` and `seed.sql` load unchanged: 20 accounts, 12,626 events.
  - Postgres weekly bucketing (`date_trunc('week', (occurred_at AT TIME ZONE 'UTC') AT TIME
    ZONE tz)`, `generate_series` zero-fill, dedup) gives 69 locations × 25 weeks = 1,725 cells
    and 12,517 events, identical to the Python diagnostics.
  - `2026-06-03 02:30 UTC` in New York gives `2026-06-02 22:30`, week 2026-06-01.
- **Statistics library** (scratch npm project): `@stdlib/stats-base-dists-negative-binomial-cdf`
  0.2.3 matches scipy on 73 T3-shaped cases (non-integer r, w = 1 and 4) with a worst relative
  error of 3.22e-14. `jstat` 1.9.6 returned NaN on some cases and was rejected.
- **npm versions checked:** vitest 5.0.1, fastify 5.12.5, express 5.2.1, pg 8.23.0,
  @testcontainers/postgresql 12.1.0, @testing-library/react 16.3.3.
- **Baseline check:** the lowest 12-week median in the seed is 3 for a location and 5.5 for an
  account, so the 0.1 floor never applies. This replaced an unverified sentence the agent had
  first written into PLAN §4 in this same turn.
- **Agreed with Vitest.** Argued that it has to cover four layers:
  - unit tests for the gate, against a committed scipy fixture;
  - integration tests on a real Postgres through Testcontainers, never a mocked database;
  - API tests with `fastify.inject()`;
  - web tests with Testing Library and jsdom.

  Flagged a Node-specific risk: by default `pg` parses `timestamp` and `date` into
  process-local `Date` objects. Mitigations: bucket in SQL, return text, pin the parser to UTC,
  and run the tests with `TZ=America/Los_Angeles`. (This is known `pg` behaviour; not
  re-verified in this turn.)
- **PLAN.md changes:**
  - D13 (T3) and D14 (stack) added.
  - New §4, the gate specification, followed by the T3 measurements from E6.
  - New §5, the stack. Proposed picks within the user's choice: Fastify 5 (Express 5 equally
    fine), `pg` with hand-written SQL, plain-SQL migrations with a TypeScript runner, and
    React + Vite with plain fetch. It also includes the verified weekly SQL.
  - New §6 open decisions:
    - O10 (now unblocked);
    - O12, the calls-vs-total tension raised in E6, with a recommendation to show per-type
      counts in the account verdict and gate per type only where volume allows;
    - O13, how the account is chosen, with a recommendation of an id in the URL and no auth,
      stated as a limitation.
  - §8 checks gained a T3 regression anchor and a non-UTC time zone check.
  - Sections renumbered; a stale §6 reference was fixed.

Repo changes: `PLAN.md`; this log entry. No application code yet.

**My call:** accepted — verifying the seed and the week bucketing against a real Postgres, and
validating the stats library against scipy on 73 cases instead of trusting it, is exactly
what I want.

**Who was right:** (no disagreement)

## E8 — D6 corrected to per-type; O10/O12/O13 closed; requirements list revealed; LLM section

**Me:**
> One thing first, fix D6: the gate runs on the selected event type, not all types together. "Total
> volume" meant volume rather than rates.
> For the stack: Fastify is fine, we can go with it. For migrations I'd prefer using an established library rather than a hand-written runner.
>
> O10: account verdict with its range on top. Below it, locations appear only when the gate flags them, otherwise one line saying nothing unusual at any location. Single-site accounts get no location section.
> O12:  gate the selected event type, and drop the "only where volume allows" rule.
> O13: agreed, accound id in the URL, no auth, stated as a limitation.
>
> Now with all the gaps closed and this is key, before we close the plan: I held back the take-home's requirements list on purpose, so you'd work out the problem rather than the rubric. The design is settled now, so here it is. Check PLAN.md against it and fill whatever is missing.
>
> From the brief, every submission must have:
> - Backend: at least one API endpoint that performs real aggregation over the seed data
>   (not pass-through queries).
> - Frontend: a web UI that consumes it, with at least one piece of user-controlled input
>   whose state survives a page reload.
> - Tests that run, with a one-line note in the README on how to run them.
> - A relational database with a real schema and migrations, using the stack's standard
>   tooling, loaded from the provided seed.
> - Runs locally from the README in about 15 minutes.
> - PLAN.md must include a short "Where would an LLM fit?" section: a specific use case
>   and why, or a well-argued "not here, because". Building it is optional; a mocked LLM
>   boundary with
> Two gaps I can already see:
>
> 1. Controls. Three inputs, all in the URL so they survive a reload: account, event type,
>    and week. The week defaults to the latest completed week from the data, and the user
>    can go back. That's also how we show the gate firing on the week of 2026-06-01.
>
> 2. There's no LLM section. For that one, write the deterministic template first and
>    decide with it in hand: if a template reads fine, defer the model and say why.

**Agent:**
- **D6 corrected** to "the selected event type, volume not rates", which also closes O12.
- **Re-measured T3 per event type** (`scratchpad/per_type.py`), since every earlier number was
  measured on all types combined. Location flags outside account 6, and the share of Mondays
  that are not quiet under pure noise:
  - `call_received`: 6 flags, 6.9%;
  - `lead_created`: 21 flags, 11.8%;
  - `appointment_set`: 57 flags, 20.9%, with 149 evaluations hitting the 0.1 floor.

  Diagnosis: the median baseline, not the test. At about 1 event a week the median of 12 weeks
  is coarse and biased low, so ordinary weeks look like rises. This is the effect that the
  "only where volume allows" rule had been hiding, and the user has now dropped that rule.
- **Compared baseline estimators** (`scratchpad/estimators2.py`, vectorized with `betainc`
  after a first version was too slow and was stopped). Location flags (calls/leads/appts),
  noise share, and account 6 echo:
  - median: 6/21/57, 6.9/11.8/20.9%, echo 0;
  - mean: 6/5/10, 3.8/3.3/3.0%, **echo 14**;
  - drop highest: 7/5/14, 5.1/5.8/5.5%, echo 0;
  - **drop highest and lowest: 4/4/9, 3.2/3.9/4.4%, echo 0**.

  Recommended the last one, but **did not change D8**, because it contradicts an accepted
  decision; raised as O14 for the user's call (CLAUDE.md rule 1's replacement).
- **Verified for the stack:**
  - `node-pg-migrate` 9 with SQL migration files (`-j sql`) runs `up`, `down`, `up` against
    Postgres 16;
  - `seed.sql` loads into the migrated schema in 494 ms: 20 accounts, 12,626 events;
  - the first migration's adaptations: `CHECK` on `event_type`, `CHECK (duration_seconds >= 0)`,
    an index on `(account_id, event_type, occurred_at)`, and deliberately **no** unique
    constraint, so the 12 duplicate groups still load.
- **PLAN.md** gained: D15 (three URL controls), D16 (layout, was O10), D17 (account in URL, was
  O13); §6 API and UI with the response shape; §7 the deterministic template, written first as
  instructed; §8 "Where would an LLM fit?"; §9 deliverables with a requirement-by-requirement
  traceability table; §10 open decisions (O14, O15); §12 checks reorganised into data handling,
  gate and UI, with per-type anchors.
- **§8 conclusion:** defer the model. The output space is four account states × three event
  types plus two location states, every sentence is a number and a comparison, and a model on
  that path adds a chance of misstating a number. The rejected candidate is free-text "why"
  questions: the data has no causal columns, so a model would invent plausible causes. Named
  what would change the answer, and described a single `explain(verdict, facts)` seam with the
  template as its default if a mocked boundary is wanted anyway.
- **Raised O15:** the brief's LLM bullet is cut off mid-sentence in the pasted text
  ("a mocked LLM boundary with …"), so the requirement may be incomplete.

Repo changes: `PLAN.md`; this log entry. No application code yet.

**My call:** accepted — and it found an error I introduced. I told it to drop the "only where
volume allows" rule, reasoning that a calibrated test would simply not fire at low volume.

**Who was right:** the agent.

## E9 — D8 switched to a trimmed mean; LLM stub argued; planning closed

**Me:**
> O14: yes, switch to the trimmed mean, drop the highest and lowest of the 12 weeks. Record in PLAN why D8 moved, and keep the numbers.
> O15:  The full sentence is: "A mocked/stubbed LLM boundary with your real prompts committed is explicitly acceptable and is evaluated the same way — don't spend your budget (or money) on API-key logistics."
> So a stub with the prompts committed counts. Keep the deferral as the plan's answer, but since you've already written the template and the explain() seam, say explicitly in 8 what a stub would cost and why it isn't worth it here.
>
> We are ready to close the planning phase.

**Agent:**
- **D8 changed** to the trimmed mean (12 weeks, highest and lowest dropped, 10 contribute). The
  gate specification in §4 now reads `NegBin(r = 10·m, p = 10/(10+w))`. The reason for the move
  and the four-estimator comparison live in §4 next to the specification, under "Why D8 moved
  from the median to a trimmed mean", rather than in the open-decisions section.
- **Re-measured everything that depended on the baseline**, since all earlier examples were
  median-based:
  - per-type location flags outside account 6: 4 calls, 4 leads, 9 appointments;
  - noise share: 3.2% / 3.9% / 4.4% at location level, 3.7% / 2.2% / 2.9% for the verdict;
  - account 6's spike day caught at 15/15 locations for calls, 11/15 leads, 5/15 appointments;
  - the 0.1 floor is reached only by appointments, in 3 of 690 location evaluations; lowest
    baselines 2.0 / 0.3 / 0.1 per location and 3.4 / 1.4 / 0.6 per account.
- **§7 template numbers replaced with verified gate output**, and the invented "flagged down"
  example replaced with a real one: account 7, calls, week of 2026-07-13, 3 calls against a
  usual 5–18, about 73% below typical. Quiet: account 1, 34 calls, usual 20–42. Up: account 6,
  528 calls, usual 31–58, about 12×. Location: account 6 Site N, 40 calls over the 4 weeks to
  7 June, usual 2–24. Account 16's usual week corrected from 1–9 to 1–10 calls.
- **§8 now argues the stub explicitly:** cost is not the objection, since the brief accepts a
  stub without an API key. The objection is that the only implementation that would ever run is
  the template, so committing prompts means maintaining a second set of sentences that nothing
  produces and that can drift. The boundary is therefore specified and not built:
  `explain(verdict, facts)`, called after the gate, numbers never re-derived by a model, the
  template as the permanent fallback. It also says that if the reviewer prefers the artefact,
  adding it changes nothing in the plan, because the prompts would be the §7 sentences.
- **§12** anchors updated to the trimmed-mean counts, plus a check that the verdict wording
  matches §7 for the four cases above.
- **Status set to "planning closed 2026-09-17"**, with no open decisions and a note that
  changing a decision now means a new log entry rather than an edit. D9's wording was corrected,
  since it had referred to the median baseline.

Repo changes: `PLAN.md`; this log entry. No application code yet.

**My call:** accepted — it re-measured every number that depended on the baseline instead of
leaving stale ones in.

**Who was right:** (no disagreement)

## E10 — The in-progress week (D18); planning closed

**Me:**
> One thing missing from the plan that I catched: the in-progress week. It's correctly never evaluated,
> but it should still be visible as a plain fact, something like "this week so far: 34
> events, 3 days in", with no comparison and no verdict. Otherwise someone opening this on
> a wednesday thinks the data is stale. After this planning should be closed

**Agent:** Agreed; the plan had the partial week only as an exclusion, which would have made
the page look stale to anyone opening it mid-week. Computed what the line would show on the
seed before writing it in, then added it.

- **Verified on the seed** (as-of = max `occurred_at` = 2026-07-27 22:20:34 UTC):
  - every account's local as-of moment is Monday 2026-07-27, from `America/Los_Angeles` 15:20
    to `UTC` 22:20, so all 20 accounts are 1 day into the week of 2026-07-27;
  - calls so far that week: account 6 → 7, accounts 5 and 12 → 6, accounts 1, 10, 15, 17, 18 →
    3, and accounts 2, 8 and 20 → none yet.
- **D18 added:** the in-progress week is shown as one line with the count of the selected event
  type and the number of days into the week; no verdict, range, percentage or comparison.
- **Rules:** the "only completed weeks" rule now says the in-progress week is never compared,
  baselined or part of a window, but is displayed as a count.
- **D7 refined** with the exact as-of timestamp and the observation that every seed account
  lands on the same local Monday.
- **§6:** `inProgress { weekStart, daysIn, count }` added to the response, `asOf` changed from a
  date to the timestamp, `daysIn` defined as the day number within the week (1 on Monday, 3 on
  Wednesday), the line always visible whichever past week is selected, and `null` when the
  as-of moment falls exactly on a week boundary.
- **§7:** wording added — "This week so far: **7 calls**, 1 day in (Mon 27 July)", and for
  accounts 2, 8 and 20 "no calls yet" rather than "0", so a quiet start doesn't read as a broken
  page.
- **§12:** a check that the line reports the partial week without judging it, with the verified
  per-account counts, and that the 2026-07-20 verdict is identical whether or not the line is
  rendered.
- **Status:** planning closed, D1–D18, no open decisions.

Repo changes: `PLAN.md`; this log entry. No application code yet.

**My call:**  accepted — I caught the gap, it verified what the line would actually show on the
seed before writing it in, and chose "no calls yet" over "0" so a quiet start doesn't read
as a broken page.

**Who was right:** me — the plan had the partial week only as an exclusion.
