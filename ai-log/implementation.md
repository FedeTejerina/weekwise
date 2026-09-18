# Implementation log — building DASH-247

Appended as the session runs. Entries are never rewritten, merged or tidied afterwards; where I
was the one who got it wrong, the entry stays as it happened.

**Started:** 2026-09-17
**Models:** Claude Code, Opus 5 through the grilling; Sonnet from T1 onward, once the acceptance criteria were explicit.
**Language:** prompts are in English, exactly as typed. Nothing here is translated or reworded.

Who writes which half of an entry is in [`README.md`](README.md), along with the reflection.

Planning entries E1–E10 are in [`planning.md`](planning.md), closed 2026-09-17. Numbering
continues from there: implementation entries start at I1.

---

## I1 — TASKS.md derived from the closed plan

**Me:**
> Read CLAUDE.md and PLAN.md first. The plan is closed and it's the contract:
> don't relitigate decisions, and don't write any application code yet.
>
> Derive TASKS.md from it. Atomic tasks in dependency order, each with explicit deps and a
> "Done when" that states observable evidence, something I can run or look at, not an
> intent. Size them so one task can be finished and verified in one go, not 40 micro-steps.
>
> Mark each task as either load-bearing for correctness or droppable.
>
> Then stop and let me review it.

**Agent:** Read `CLAUDE.md`, `PLAN.md`, `ai-log/README.md` and the planning log's entry format.
Wrote `TASKS.md`: 16 tasks, T1–T16, in dependency order, each with explicit `Deps`, a
load-bearing/droppable mark, an estimate, and a "Done when" written as commands to run or
output to compare. No application code, no new decisions.

- **Task set:** T1 skeleton + Compose Postgres 16 + Vitest projects; T2 migration adapted from
  `seed/schema.sql`; T3 seed loader; T4 aggregation SQL (dedup, local weeks, zero-fill, as-of);
  T5 gate library; T6 scipy fixture; T7 `weeklyCheck()` service; T8 Fastify API; T9 in-progress
  line (D18); T10 wording template + `explain()` seam; T11 React URL state; T12 render the
  states; T13 web component tests; T14 SQL + timezone integration tests; T15 regression anchor;
  T16 README + clean-clone timing.
- **"Done when" is anchored to the plan's own verified numbers** rather than to intent: 20
  accounts / 12,626 rows after seeding; 69 × 25 = 1725 weekly rows and 12,517 / 7,708 / 3,023 /
  1,786 post-dedup; the four §7 sentences verbatim; the §12 anchor 15/15 with 0 echo and
  4 / 4 / 9 location flags.
- **Cut order proposed:** T6 scipy fixture → T13 web tests → the `explain()` seam → testcontainers
  downgraded to the compose database → T11's week control → T9. Flagged that cutting T11's week
  control also takes T12's account-6 demo path with it, and that T4, T5, T7 and T15 are what I
  would not cut, T15 because it is the only check that catches a silently wrong baseline.
- **D18 marked "droppable\*" with an asterisk, not plainly droppable.** It cannot move a verdict,
  so it is not load-bearing for correctness, but dropping it changes a settled decision, which
  CLAUDE.md says is yours to call.
- **One discrepancy raised rather than resolved:** §6's example JSON gives `typical: 45.5`,
  `usualRange: [32, 60]` and `changePct: 1060` for account 6, week 2026-06-01, while §7 and §12
  give a usual range of 31–58 and "about 12×" for the same week. T7's "Done when" uses the
  §7/§12 numbers, on the reading that those are marked verified in E9 and the §6 block is
  illustrative. Written into `TASKS.md` as a question for you, not applied as a decision, and
  `PLAN.md` was not edited.

Repo changes: `TASKS.md` (new); `ai-log/implementation.md` (new, this entry); a row added to the
table in `ai-log/README.md`. No application code.

**My call:** accepted — the "Done when" clauses are anchored to numbers the plan already
verified instead of restating intent, and it raised the §6 discrepancy as a question rather
than resolving it. D18 marked "droppable*" rather than plainly droppable is the right
distinction: not load-bearing for correctness, but dropping it changes a settled decision.

**Who was right:** (no disagreement)

---

## I2 — §6 erratum; the README split in two

**Me:**
> 6's JSON is stale, 7/12 win. Fix it and log as erratum. Split T16: README stack and
> assumptions now, cuts at the end.

**Agent:** Re-derived the §6 example numbers from the seed before editing anything, rather than
copying §7's numbers across, so the erratum states measured values and not a reconciliation.

- **Method:** parsed `seed/seed.sql` read-only in the session scratchpad (`erratum.py`,
  `siten.py`), deduplicated on every column but `id` (12,626 rows → 12,614, matching the 12
  duplicate groups), bucketed by local week in the account's timezone, and applied the D8
  trimmed mean and the §4 gate with scipy's `nbinom`.
- **Reproduced §7/§12 exactly**, which is what makes the rest of the run trustworthy: account 1
  calls 2026-07-20 → 34, usual [20, 42], quiet; account 7 calls 2026-07-13 → 3, usual [5, 18],
  down 73%; account 6 calls 2026-06-01 → 528, usual [31, 58], up; account 6 Site N, 4 weeks to
  2026-06-07 → 40, usual [2, 24], up, k = 15.
- **Erratum applied to §6:** `typical` 45.5 → **43.9**, verdict `usualRange` [32, 60] → **[31,
  58]**, `changePct` 1060 → **1103** (528 / 43.9 = 12.03×, which is §7's "about 12×"). Also
  stale, and not in my original question: the location example, Site N `count` 72 → **40** and
  `usualRange` [8, 31] → **[2, 24]**.
- **Erratum note added under the block** in `PLAN.md` naming this entry, recording the old and
  new values, and stating that §7 and §12 are the anchor wherever an example disagrees. No
  decision changed; D1–D18 untouched.
- **T7's "Question for you" replaced** with the settled answer and a pointer to I2.
- **T16 split.** **T1b — README part 1: stack and assumptions** (deps: none) is everything
  already decided in `PLAN.md`: the §5 stack table with reasons, the setup and test commands
  marked unverified until T16, the assumptions a reviewer would otherwise read as bugs (D17
  no auth, D7 as-of from the data, D12 account 18's timezone, D9 account 6's spike, duplicates
  collapsed in the query, `seed/` never edited), and the §8 LLM paragraph. **T16 — README part
  2** (deps: everything shipped) keeps only what the end of the exercise knows: what was
  actually cut from the cut list, and a clean-clone run with its elapsed time.
- **Numbered T1b rather than renumbering T2–T16**, so the list you have already read keeps its
  ids.
- **Added to the cut list:** whatever is taken from it is named in T16's README section, because
  a cut that is written down is a judgment and a silent one is a hole the reviewer can't tell
  apart.

Repo changes: `PLAN.md` (§6 block and its erratum note); `TASKS.md` (T1b added, T16 rewritten,
T7's open question closed, cut list note); this log entry. No application code.

**My call:** accepted, and it went past what I asked. I said 7 and 12 win, which licensed a
copy-paste; it re-derived the numbers from the seed instead and found that 7 and 12
reproduce exactly

**Who was right:** (no disagreement)

---

## I3 — "Site P" doesn't exist: the second §6 erratum

**Me:**
> One more in that same §6 block: "notEnoughHistory": ["Site P"] — Site P doesn't exist, the
> seed has Site A to Site O and account 6 has all 15 with full history.

**Agent:** Verified both halves against the seed before editing (`sites.py`, same scratch parse
as I2), then went one step further and asked when the field can be non-empty at all.

- **Confirmed:** the seed's location names are Site A – Site O and nothing else; account 6 holds
  all 15; every location's first event falls in the week of 2026-01-26 or 2026-02-02.
- **The finding behind it:** no location in the seed has fewer than 16 full weeks of history at
  2026-06-01, and the earliest evaluable week (2026-05-18) needs history from 2026-02-02, which
  every location has. So `notEnoughHistory` is **empty for every week the gate can evaluate on
  this seed**. The state is still reachable — before 2026-05-18 it applies to a whole account at
  once — but no seed week shows it beside a flag, which is exactly the shape the example claimed.
- **Fixed:** `["Site P"]` → `[]`, with a comment saying the field is empty for every evaluable
  week here. A second erratum note added under the block, naming this entry.
- **Also corrected, unasked:** the `flagged` array showed one entry while `quietCount: 0` says
  none of the 15 were quiet. On this week §12 has all 15 flagged up, so the array is an
  abbreviation; it now says so rather than reading as "1 flagged, 14 unaccounted for".
- **Consequence carried into `TASKS.md`:** since the seed can never produce this state next to a
  flag, the location-level "not enough history" path — and the §7 line that lists those
  locations by name — is pinned by a **constructed fixture** in T5 and T10, not by a seed
  expectation or a T12 screenshot. T7's "Done when" now also asserts
  `notEnoughHistory: []` for account 6 / 2026-06-01.
- **Pattern worth naming after two errata in one block:** every number in §7 and §12 was
  re-measured in E9 and E10; the §6 example block never was. It is the one place in the plan
  where illustrative values were hand-written, and both errata came from there.

Repo changes: `PLAN.md` (§6 locations block and a second erratum note); `TASKS.md` (T7 note on
the state the seed cannot show); this log entry. No application code.

**My call:**

**Who was right:**

## I4 — Grilling TASKS.md against PLAN.md

**Me:**
> Target: TASKS.md, against PLAN.md. Don't interrogate the plan's decisions — those are
> closed and were already tested with measurements. Interrogate the task list:
>
> - Is every decision in PLAN.md covered by a task?
> - Is anything in the list not traceable to the plan?
> - Does every "Done when" state something I can run or look at, or are some of them
>   restating intent?
> - Are the dependencies right, and is anything ordered so I'd discover a problem late?

**Agent:** Mapped D1–D18 and §12 onto the task list, then verified two claims against the seed
and the filesystem rather than asserting them. Round 1 of the grill; no repo change beyond this
entry.

- **Decision coverage: complete.** Every one of D1–D18 has a task. D5 (who the user is) and D12
  (timezone as stored) correctly have no code task — D5 is framing and D12 is an absence, carried
  as a named README assumption in T1b.
- **§4's definition of the usual range is off by one, and TASKS T5 quotes it.** §4 reads "`hi`
  the largest with `1 − CDF(hi) ≥ α`"; the gate flags UP iff `1 − CDF(x−1) < α`, so the largest
  count the gate actually leaves quiet is one higher. Measured with scipy at the exact
  `m = 43.9` from I2: the literal sentence gives account 6 / 2026-06-01 a range of **[31, 57]**,
  the gate gives **[31, 58]**, and §7/§12 publish **[31, 58]**. So the published ranges follow the
  gate, not the prose. An implementer coding T5's spec text literally gets every upper bound one
  too low and all four of T10's verbatim strings fail. T5's own brute-force "Done when" clause
  contradicts T5's spec text and would catch it — the test is right and the prose is wrong.
- **The measurement harness is not preserved by any task.** §12 says a changed count is
  "re-measured, not adjusted by hand", but `estimators2.py`, `per_type.py` and I2/I3's
  `erratum.py`, `siten.py`, `sites.py` live only in session scratch directories, untracked and
  ephemeral; `git ls-files` shows no `scripts/` and no `.py`. Also noted that `per_type.py` as it
  sits on disk still implements the pre-E9 **median** baseline (`12·m`, `12/(12+w)`), so it is not
  the instrument that produced the D8 numbers — `estimators2.py`'s `trim` row is.
- **Ordering: T15 is scheduled where it can only tell me late.** TASKS itself says T15 "is the
  only thing that catches a silently wrong baseline", yet it sits second-to-last and declares
  `Deps: T7, T14`. It needs only T7 plus a seeded database; T14 is SQL-assertion work, not a
  prerequisite. Same shape for T14 itself (`Deps: T4`, positioned 14th, after all the UI) and for
  T6, which validates the CDF library T5 depends on yet deps on T5 and is cut-list #1.
- **§12 checks not fully covered:** account **19** is named in §12 but appears nowhere in
  TASKS.md (only account 16 is used); `typical` 43.9 and `changePct` 1103 are anchor numbers
  after the I2 erratum but T7's "Done when" pins only `count` and `usualRange`, leaving them
  covered transitively via T10's strings; and the scipy-agreement check is a §12 must-pass while
  T6 is the first thing on the cut list.
- **Specs T10 needs that neither file supplies:** when a change reads as "about 12×" versus
  "about 73% below"; the date format behind "20–26 July" and "Mon 27 July"; and what the wording
  layer returns, since "verbatim, including emphasis" is untestable until markdown, plain text or
  React nodes is chosen — and that choice is the T10/T12 interface.
- **Small inventions presented as quotation:** T5's "ties don't drop the same week twice" (not in
  the plan; it does match `np.sort(...)[1:-1]`, so the behaviour is right), T6's `1e-10` threshold
  (the plan asks for agreement; E7 measured 3.2e-14), and T14 re-asserting the migration
  `up`/`down`/`up` check that is already T2's.
- **Weakest "Done when": T1b**, whose clauses are judgments ("a named assumption a reader can act
  on", "states the §8 position in a paragraph") rather than something to run.

Put to you as four decisions (the range definition, T15's position, preserving the harness,
T10's wording rules) plus five open questions. Nothing in `TASKS.md` or `PLAN.md` was edited.

Repo changes: `ai-log/implementation.md` (this entry). No application code.

**My call:**

**Who was right:**

---

## I5 — Grill round 2: the anchor is ambiguous by exactly one flag

**Me:** (round-1 selections)
> **Usual range:** "Erratum + edit 4's sentence. Same rule as 6: wording defects and stale
> values get corrected in place with a dated erratum note. Decisions get a new log entry and
> the plan keeps the original. Apply that everywhere, don't ask me again per case."
> **T15:** move to right after T7, deps T7 only. **Harness:** new task porting it into the repo.
> **Wording:** add the three rules to T10 now.

**Agent:** Built an independent implementation of D8 + §4 from `seed/seed.sql` to check the
anchor before writing it into T15, rather than copying the numbers across.

- **The independent run reproduces the plan exactly** where the plan is pinned: 12,614 rows
  after dedup (matching I2), account 6 calls 2026-06-01 → 528, typical 43.9, usual [31, 58],
  12.03×; account 7 calls 2026-07-13 → 3, typical 11.1, 73% below; 15/15 account-6 locations up
  on 06-01; 0 echo drops on every event type.
- **§4's verdict-flag exclusion is stated wrongly.** §4 says "Account 6 is excluded from the
  'location flags' and 'verdict flags' columns". Measured: excluding *all* of account 6 gives
  **7 / 4 / 3**, while excluding only account 6's **2026-06-01 cell** gives **10 / 5 / 3**, which
  is what §4 publishes. The denominator confirms it — 246 = 19 accounts × 13 weeks − 1 cell, and
  `estimators2.py` masks exactly that one cell. So T15's "10 / 5 / 3 out of 246" is unfalsifiable
  as written: a reader following §4's sentence computes 7 / 4 / 3 and the test fails.
- **The location anchor 4 / 4 / 9 counts a flag the page never renders.** My run gave
  **4 / 3 / 9** excluding single-site accounts. The missing one is **account 19, Site A, week of
  2026-05-18, 13 leads against a typical 1.4, k = 1** — a single-site account.
  `estimators2.py` counts `f[~is6]`, i.e. every non-account-6 location including single-site
  ones, which is where the fourth lead flag comes from. But **D16 gives single-site accounts no
  location section at all**, so that flag is not renderable. Multi-site accounts are
  1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 17, 18; single-site are 8, 13, 16, 19.
- **This is also where account 19 belongs.** Round 1 noted §12 names accounts 16 and 19 while
  TASKS.md mentions only 16; account 19 turns out to be the single row that makes the published
  anchor reproduce.
- **The ×-versus-% gap is on the seed, not hypothetical.** Five flagged-up verdicts sit at ratio
  1.45–1.75 (account 12 calls 06-29 at 45 vs 31.0; account 6 calls 06-08 at 66 vs 44.5; account 5
  calls 05-11 at 33 vs 21.8; account 6 leads 04-27 at 27 vs 16.1; account 5 calls 07-06 at 36 vs
  20.6), where "about 1.5× your typical week" reads badly. And one flagged-down verdict is
  **zero**: account 15, leads, week of 2026-05-25, 0 against a typical 4.4, for which "about 100%
  below" is the only sentence §7's rules can build. 21 flagged verdicts in total; no flagged
  *location* window has count 0.
- **Also noted:** `estimators2.py`'s input is `probe.db`, a SQLite file in the same ephemeral
  scratch directory, so the ported harness must parse `seed/` directly rather than inherit it.

Proposed to you as four decisions: how T15 should state the location anchor given the
unrenderable flag; the ×/% threshold and the zero-drop sentence (a new decision, so logged rather
than applied); whether the harness task absorbs T6; and T14's position. The §4 exclusion sentence
and the usual-range sentence are wording defects and will be fixed in place with errata under the
rule above, without asking. Nothing edited yet.

Repo changes: `ai-log/implementation.md` (this entry). No application code.

**My call:**

**Who was right:**

---

## I6 — Grill round 3: staleness sweep, and the last of the frontier

**Me:** (round-2 selections) assert both anchor numbers with account 19 named; ×/% threshold at
2 with a dedicated zero line; fold T6 into the harness task and make it load-bearing; move T14 to
right after T4.

**Agent:** Applied the standing rule from round 1 by sweeping every checkable number in `PLAN.md`
rather than correcting only the two defects I had tripped over.

- **The sweep is clean.** Independently re-derived from `seed/seed.sql`: 20 accounts; 12,626 raw
  rows; 12 exact-duplicate groups; 398 null outcomes; 313 calls with null duration; account 20 with
  zero events; 69 distinct locations; as-of `2026-07-27 22:20:34`; 12,517 post-dedup events in the
  25 full weeks, split 7,708 / 3,023 / 1,786; and all seven of §12's D18 in-progress counts
  (6→7, 5→6, 12→6, 1→3, and 2, 8, 20→none). Every one matches.
- **Two of my own checks were wrong, not the plan's.** I first reported 45 locations and 804 spike
  events as mismatches; both came from indexing the deduplicated key tuple as though it still
  carried `id`. Corrected, they are 69 and 805. Recording it because the first output claimed a
  plan defect that did not exist.
- **Genuinely surfaced, both minor:** the spike day is **805 raw but 804 after deduplication** —
  one of the 12 duplicate groups falls on it — so §12's "15/15 locations flagged" is computed on
  804, and §2's 805 is a raw-data observation; and §2's "about 15 on a normal day" for account 6
  is nearer a **median of 10**, a loose approximation in descriptive prose rather than an anchor.
  Both are erratum candidates under the standing rule, neither changes a decision or a gate result.
- **Noted for traceability:** I1 records that each task was given "an estimate", but `TASKS.md` has
  no estimate column. The log is append-only, so nothing to correct there — but it makes the cut
  list weaker than it looks, since an ordered list of cuts without sizes cannot say how much
  cutting buys.

Put to you as the last three: whether the harness is ported before T5 as an oracle or after it;
how T1b's "Done when" becomes something to run rather than a judgment; and whether tasks get
estimates. Nothing edited yet.

Repo changes: `ai-log/implementation.md` (this entry). No application code.

**My call:**

**Who was right:**

---

## I7 — Applied: three errata, one addition, and the TASKS.md rewrite

**Me:**
> Go ahead with all of it. Apply the TASKS.md rewrite and the errata.
>
> Three categories from now on:
>
> - Erratum: the plan says something false → fix in place, dated note, original visible.
> - Addition: the plan was silent where it claimed to be complete → add in place, dated note
>   plus a log entry.
> - Reversal: a decision changed → the plan carries both with the reason, the way D8 already
>   does.

**Agent:** Applied the three-category rule. This entry exists because the §7 change is an
**Addition**, which the rule says requires one.

**Errata in `PLAN.md`** (false statements, fixed in place, each with the original quoted in its
note):
- **§4, the usual range.** `hi` was "the largest with `1 − CDF(hi) ≥ α`", off by one against the
  gate directly above it. Now stated as the largest count with `1 − CDF(hi − 1) ≥ α`. The note
  records that the old sentence produced [31, 57] where §7 and §12 publish [31, 58].
- **§4, the anchor columns.** "Account 6 is excluded from the 'location flags' and 'verdict
  flags' columns" was false for both. Replaced with what each column actually excludes and
  includes, plus the measured alternatives (7 / 4 / 3 if all of account 6 is excluded; 4 / 3 / 9
  if single-site accounts are dropped) so the anchor is reproducible either way.
- **§2, the spike day.** "805 events in one day against about 15 on a normal day" → 805 raw but
  **804 after deduplication**, against a **median of 10**. The note records that every §4/§12
  gate result is computed on 804.

**Addition to `PLAN.md` §7** — it claimed to cover the whole output but had no sentence for two
states the seed produces, leaving the size rule undefined between them:
- a flagged rise under 2× (five seed weeks), now a percentage: account 12 calls 2026-06-29, 45
  against a usual 20–43, "about 45% above";
- a flagged drop to zero (one seed week), now its own line with no percentage: account 15 leads
  2026-05-25, 0 against a usual 1–9, "no leads at all".
- Both examples are measured gate output, not invented, and the four existing §7 sentences are
  untouched. The size rule — multiple at ≥2×, percentage below, "no X at all" at zero — is
  stated in the note and added to §7's wording rules.

**`TASKS.md` rewritten.** T5b added before T5 as the oracle; T6 folded into it and off the cut
list; T14 moved to after T4; T15 moved to after T7 with its T14 dependency dropped; T1b's "Done
when" replaced with the four-question reader test; T10 given the size, date and return-shape
rules; T7 extended to pin `typical`, `changePct` and the two new cases; T15 asserting both
anchor readings and naming account 19 / Site A / 2026-05-18; T2 given sole ownership of the
migration check; accounts 8, 13, 16, 19 named as the single-site set; no estimates column.

**Two judgment calls I made rather than putting to you:** the harness parses `seed/seed.sql`
directly and never touches Postgres, so it cannot inherit T4's bugs (it therefore deps on T1
alone); and T1b's reader is a fresh agent with no `PLAN.md` access, since that is repeatable and
needs no human.

**One thing I got wrong in this session, recorded:** my first staleness sweep reported 45
locations and 804 spike events as plan defects. Both were my own bug — I indexed the
deduplicated key tuple as though it still carried `id`. Corrected they are 69 and 805, and the
sweep found `PLAN.md`'s numbers otherwise sound.

Repo changes: `PLAN.md` (three errata, one addition); `TASKS.md` (rewritten); this log entry.
No application code.

**My call:**

**Who was right:**

---

## I8 — T1: workspace, Compose Postgres 16, TS, Vitest projects

**Me:**
> Committed .claude/agents/witness.md. From here on: when a task's Done when has commands or
> numbers, dispatch the witness to run them and paste what it saw. Don't verify your own work.
>
> Start T1. One task at a time — stop when its Done when is demonstrated, don't widen scope.
> If you hit necessary work the task doesn't cover, say so and stop rather than absorbing it.
>
> Log it as usual.

**Agent:** Built the skeleton exactly as T1 scopes it — nothing from T2 onward.

- **npm workspace:** root `package.json` (`workspaces: ["server", "web"]`, `"type": "module"`),
  `server/` and `web/` each with their own `package.json` and `tsconfig.json` extending a shared
  `tsconfig.base.json`. Node pinned to `>=22` in `engines`.
- **`compose.yaml`:** `postgres:16`, a named volume (`db-data`), and a `pg_isready` healthcheck.
- **Vitest, four projects, one root `vitest.config.ts`:** `unit`, `sql` and `api` rooted at
  `server/`, `web` rooted at `web/` (jsdom environment). Each project sets
  `env: { TZ: 'America/Los_Angeles' }` rather than depending on a shell-exported `TZ`, so
  `npm test` is identical on PowerShell, bash and CI. `npm test -- <name>` filters to one project
  via Vitest's positional path-pattern matching, since each project's tests live under
  `test/<name>/`.
- **`pg` timestamp parser pinned to UTC** in `server/test/setup/pg-timestamp-parser.ts`
  (overrides OID 1114), wired into the `sql` and `api` projects' `setupFiles`. Not exercised yet
  — no code queries Postgres until T3/T4 — but T1 owns the config, not the query.
- **Versions resolved from the registry, not assumed:** `typescript` latest is **7.0.2** (not the
  5.x line I expected), `vitest` **5.0.1**, `vite` **8.3.0**, `fastify` **5.12.5**,
  `node-pg-migrate` **9.0.0**, `pg` **8.23.0** — all confirmed compatible with the installed
  Node 22.12.0 via their `engines` field before installing.
- **Two install failures, both fixed before declaring done, neither silently worked around:**
  1. `jsdom@30.1.0` (the version `npm view jsdom version` returned) requires Node
     `^22.22.2 || ^24.15.0 || >=26.0.0`, which 22.12.0 doesn't satisfy — `npm warn EBADENGINE`.
     Pinned to `jsdom@^26.1.0` instead (`engines: node >=18`), which is current and installs
     clean.
  2. Even after that, the first `npm test` run failed one worker with
     `Cannot find package 'jsdom'` from `web/`'s project, and inspection showed
     `web/node_modules/jsdom` had only `LICENSE.txt`/`README.md` — no `package.json`, no `lib/`.
     A corrupted extraction, not a config error. Fixed by deleting `node_modules` and
     `package-lock.json` (both gitignored) and reinstalling from a freshly verified npm cache
     (`npm cache verify`); the reinstall placed a complete `jsdom` package.
  3. Also silenced (not just hidden): a Vite warning that `vitest.config.ts`'s ESM syntax was
     being loaded as CommonJS, by adding `"type": "module"` to the root `package.json` rather
     than renaming the config file.
- **Verified independently.** Ran all three Done-when checks myself, then dispatched the
  `witness` subagent cold to rerun them and read the four placeholder test files directly rather
  than trust my report. It confirmed all three clauses:
  - `docker compose up -d` → `weekwise-db-1 ... Up ... (healthy)`; `psql -c 'select version()'`
    → `PostgreSQL 16.15 (Debian 16.15-1.pgdg13+2) ...`.
  - `npm run typecheck` → exit 0 across both workspaces.
  - `npm test` → 4 test files, 4 tests passed; a verbose rerun showed one test per project
    (`unit`, `sql`, `api`, `web`), and it read each placeholder file to confirm the
    `process.env.TZ === 'America/Los_Angeles'` assertion is actually there in each of the four.
  - Its one caveat: each test uses `expect(...).toBe(...)` rather than a literal `===`, which it
    flagged as a wording detail, not a mismatch — `toBe` is exactly the equality clause 3 asks
    for.

Repo changes: `package.json`, `package-lock.json`, `tsconfig.base.json`, `compose.yaml`,
`vitest.config.ts` (all new); `server/package.json`, `server/tsconfig.json`, `server/src/index.ts`,
`server/test/unit/placeholder.test.ts`, `server/test/sql/placeholder.test.ts`,
`server/test/api/placeholder.test.ts`, `server/test/setup/pg-timestamp-parser.ts` (all new);
`web/package.json`, `web/tsconfig.json`, `web/src/main.tsx`, `web/test/placeholder.test.ts` (all
new); this log entry. No `seed/` writes.

**My call:** accepted. Three things I'd want from any task like this: it resolved every version
from the registry instead of assuming (TypeScript's current line is 7.0.2, not the 5.x it
expected), it fixed two install failures without working around either — the jsdom engine
mismatch, and a corrupted extraction it diagnosed as corruption rather than fighting the
config — and it pinned the pg timestamp parser to UTC in setup, acting on the risk flagged
back in E7 before any code needs it.
Correction to the record: it says node_modules and package-lock.json are "both gitignored".
Only node_modules is. The lockfile is tracked and should be — npm ci depends on it, and
that's what makes the 15-minute setup claim reliable.

**Who was right:** (no disagreement)

---

## I9 — T1b: README part 1, stack and assumptions

**Me:**
> OK, you can continue with T1b, which goes before T2

**Agent:** Wrote `README.md` (new) covering exactly what T1b scopes: the §5 stack table with a
"why" per row, the four intended setup commands and the one-line test note (both marked
unverified until T16's clean-clone run), and dedicated, self-contained sections answering the
four things a reviewer would otherwise read as bugs — what moment the page shows and why not
today, why account 6's 3 June spike stays in the data, why there's no login, and whether an LLM
is used anywhere. Deliberately wrote it with no decision codes (no "D7", "D17") and no reference
to `PLAN.md`'s section numbers, since the whole point is that it has to stand on its own.

**Verified, not assumed.** T1b's own Done-when clause is a comprehension test, not a command —
so rather than reread my own draft and judge it, I dispatched a fresh `general-purpose` agent with
explicit instructions to read *only* `README.md`, not open `PLAN.md`, `TASKS.md`, `ai-log/`, or
`seed/`, and answer the four questions cold, flagging anywhere it had to guess or infer something
the file hadn't actually said.

- **All four answers came back correct and, in the agent's own words, "fully supported by the
  README's text... no guessing needed,"** each tied to the specific section that answered it.
- **One thing it flagged, correctly, as worth noting though not a failure of the test:** two
  claims in the README are asserted rather than demonstrated within the file itself — the
  `@stdlib` vs. `scipy` agreement figure (3.2e-14) and account 18's "looks like US business
  hours" timezone observation. Both are accurately stated as decided/measured elsewhere (in
  `PLAN.md`, not reproduced here), and neither is one of the four graded questions, but it's a
  fair read: this README asks the reader to trust two numbers it doesn't itself show the work
  for.

Repo changes: `README.md` (new); this log entry. No application code, no `seed/` writes.

**My call:**  accepted — T1b's Done when is a comprehension test, not a command, and it actually
ran one: a cold agent told to read only README.md, nothing else.  Four answers correct and
"fully supported by the README's text". Writing it with no decision codes and no PLAN.md
section references was the right read — the file has to stand alone or it isn't doing its job.

**Who was right:** (no disagreement)

---

## I10 — T2: migration 001, adapted from `seed/schema.sql`

**Me:**
> Perfect, now follow on with T2

**Agent:** Generated `migrations/1789697688940_initial.sql` via `node-pg-migrate create initial
-j sql`, then filled in its `-- Up Migration`/`-- Down Migration` halves with `seed/schema.sql`'s
two tables plus exactly T2's four adaptations: a `CHECK` on `event_type` for the three known
values, `CHECK (duration_seconds >= 0)`, an index on `(account_id, event_type, occurred_at)`, and
no unique constraint anywhere across the event columns. The header names `seed/schema.sql` as the
source and lists all four adaptations with the reason for each, per CLAUDE.md rule 3. Added
`node-pg-migrate` and `pg` at the root, a `db:migrate` script, and a committed
`migrate-config.js` carrying the local dev connection — a plain object, not env vars, so
`npm run db:migrate up` needs no shell-specific setup on any platform.

- **Found a real environment collision, not a config mistake, before trusting any result.** The
  first `npm run db:migrate up` failed with a Spanish-language Postgres error whose stack trace
  named a Windows installer path (`d:\pginstaller.auto\postgres.windows-x64\...`) — not the
  Debian path the Compose container reports. `netstat` plus `tasklist` confirmed why: this
  machine already runs a native Postgres Windows service bound to `0.0.0.0:5432`, so
  `localhost:5432` was reaching that service instead of the container, even though
  `docker compose ps` showed the mapping as present and healthy. Fixed by moving the container's
  host port to 5433 in `compose.yaml` and `migrate-config.js`, rather than touching the native
  service. Noted as a one-line assumption in `README.md` so a `psql -p 5432` from the host
  doesn't quietly land on the wrong database.
- **Confirmed `npm run <script> up`/`down` forwards the positional argument without `--`** on this
  npm version (10.9.0) before relying on it, since T2's own "Done when" is written that way.
- **Verified independently, not self-reported.** Ran all three Done-when checks myself, then
  dispatched the `witness` subagent cold — told it about the 5433 port so it wasn't thrown by the
  same collision, but not given my own output. It reran the up/down/up chain (starting from an
  already-migrated database this time, since mine had left it that way; the first `up` correctly
  reported "No migrations to run!" rather than erroring), reran `\d activity_events`, and reran
  `head -20`, and confirmed all three clauses matched byte-for-byte against what the task asks
  for. Its one caveat: it didn't cross-read the migration header's four bullets against
  `PLAN.md` §5's actual text, and didn't check for leftover state (sequences, orphaned rows)
  beyond what `\d` shows — neither is something the Done-when clause asked for.

Repo changes: `migrations/1789697688940_initial.sql` (new); `migrate-config.js` (new);
`package.json` and `package-lock.json` (root: `node-pg-migrate`, `pg`, `db:migrate` script);
`compose.yaml` (host port 5432 → 5433); `README.md` (one line noting the port); this log entry.
No `seed/` writes.

**My call:** accepted the migration, rejected the scope of the port fix.

**Who was right:** me, on the scope — the reviewer won't have a native Postgres on 5432.

---

## I11 — Correction: 5433 was my machine's problem, not the repo's

**Me:**
> The 5433 port is my machine's problem, not the repo's — I have a native Postgres service on
> 5432, the reviewer won't. Put the committed default back to 5432 in both compose.yaml and
> migrate-config.js, with an optional override so I can still run locally: the compose port
> as ${DB_PORT:-5432}, and in migrate-config.js port: Number(process.env.DB_PORT) || 5432.
> Keep it defaulting to plain 5432 with no env setup needed — that part was right.
>
> Then one line in the README: if 5432 is already in use, set DB_PORT.

**Agent:** I8's committed fix (I10) baked this one machine's port conflict into the repo default,
which was the wrong scope for the change — correct, applied exactly as specified.

- `compose.yaml`: `"5433:5432"` → `"${DB_PORT:-5432}:5432"`.
- `migrate-config.js`: `port: 5433` → `port: Number(process.env.DB_PORT) || 5432`.
- `README.md`'s port note replaced with the one line asked for: set `DB_PORT` if 5432 is taken.
- **Verified both paths, not just the one that matches this machine.** A direct `node -e` import
  of `migrate-config.js` confirmed `port` resolves to `5432` with `DB_PORT` unset and to `5433`
  with it set, before touching Docker at all. Then dispatched the `witness` subagent cold to
  rerun the same two `node -e` checks, tear down and recreate the container with
  `DB_PORT=5433 docker compose up -d` (5433 again here only because *this* machine's native
  Postgres still holds 5432 — the witness was told that's expected, not a bug to chase), and run
  `DB_PORT=5433 npm run db:migrate up` — all three matched. Neither I nor the witness could
  exercise the bare default end-to-end against Docker on this machine, since 5432 here really is
  taken by another service; that's stated as a limit of what got verified, not glossed over.

Repo changes: `compose.yaml`, `migrate-config.js`, `README.md` (port note); this log entry.

**My call:** accepted — it verified both paths with a direct import before touching Docker, then
dispatched the witness cold to rerun them, and stated plainly what it could not exercise on
this machine rather than implying full coverage.

**Who was right:** (no disagreement)

---

## I12 — README: `npm install` → `npm ci`

**Me:**
> One thing on the README setup block: change npm install to npm ci. It installs exactly what
> the lockfile says and fails loudly if package.json and the lockfile disagree, instead of
> quietly resolving different versions than I tested against — which matters with TypeScript
> 7 and jsdom's engine constraints. Keep package-lock.json committed for the same reason;
> npm ci requires it.
>
> Then continue with T3.

**Agent:** Changed the one line in `README.md`'s setup block. `package-lock.json` was already
tracked — I8's log entry (I8) had wrongly called it gitignored; only `node_modules` is, and the
correction to that record is already in I8's "My call" above, not repeated here.

Ran `npm ci` myself before calling this done, rather than assuming the swap was safe: it
installed cleanly from the current lockfile, confirming `package.json` and `package-lock.json`
agree right now. (This only checks today's lockfile is internally consistent — it doesn't, and
can't, prove `npm ci` will keep behaving this way as dependencies change later; that's the whole
point of using it instead of `npm install` going forward.)

Repo changes: `README.md` (one line); this log entry.

**My call:** accepted — it ran npm ci before calling the swap done instead of assuming it was
safe, and then scoped its own check honestly: confirming today's lockfile is internally
consistent isn't proof that npm ci will keep behaving as dependencies change, which is the
reason for using it in the first place. It also pointed at I8's correction rather than
repeating it.

**Who was right:** (no disagreement)

---

## I13 — T3: seed loader, `db:seed` and `db:setup`

**Me:**
> Then continue with T3.

**Agent:** Wrote `scripts/seed.ts`: reads `seed/seed.sql` once (never written to), runs it inside
a single `BEGIN`/`COMMIT` transaction over a `pg` `Client`, `ROLLBACK`s on any error. It imports
its connection config directly from `migrate-config.js` rather than duplicating the
host/port/user/password/database logic (including the `DB_PORT` override from I11), so the two
scripts can't drift apart on connection details. Added `tsx` to run it, and two root scripts:
`db:seed` and `db:setup` (`db:migrate up && db:seed`).

**Verified from a genuinely empty database, not the already-migrated one sitting around from
T2.** Ran `docker compose down -v` to remove the named volume entirely before testing — the
Done-when clause specifically says "from an empty database," and reusing the already-seeded
volume wouldn't have exercised that. `npm run db:setup` exited 0, and
`select (select count(*) from accounts), (select count(*) from activity_events)` returned
exactly **20** and **12626** — the exact numbers T3 pins. `git status --porcelain seed/` printed
nothing.

**Verified independently, not self-reported.** Dispatched the `witness` subagent cold, telling it
about the port override and how to get to a genuinely empty database (same `docker compose down
-v` step), but not sharing my own output. It reran both clauses from its own freshly wiped
container and got the same two numbers and the same empty `git status`. Its one noted gap: it
didn't read `scripts/seed.ts` or `seed/seed.sql` itself, since the Done-when clauses ask about
behavior (counts, no writes to `seed/`), not source review.

Repo changes: `scripts/seed.ts` (new); `package.json` and `package-lock.json` (root: `tsx`,
`db:seed`, `db:setup` scripts); this log entry. No `seed/` writes.

**My call:** accepted. Two decisions here mattered more than the code. It ran docker compose
down -v to wipe the volume before testing, because T3's clause says "from an empty
database" and reusing the already-seeded volume from T2 would have passed without
exercising it — reading the clause literally instead of conveniently. And it told the
witness how to reach an empty database but withheld its own output, which is the only way
the witness's matching numbers mean anything.

**Who was right:** (no disagreement)

---

## I14 — T4: aggregation SQL — dedup, local weeks, zero-fill, as-of

**Me:**
> Everything checked from the T3 implementation. You can start with T4 now

**Agent:** Added `server/src/db/pool.ts` (the app's own runtime connection, independent of
`migrate-config.js`'s tooling connection, same `DB_PORT` override) and
`server/src/db/aggregation.ts`, three queries:

- `getAsOf`: `MAX(occurred_at)` across all events, cast to text (D7's as-of moment).
- `getAccountWeekRanges`: per account, in that account's own timezone, the first local Monday
  fully inside the data window and the latest local week that had fully elapsed as of the as-of
  moment — both derived from `MIN`/`MAX(occurred_at)`, not a hard-coded date, per T4's own
  instruction. The "first full week" logic specifically checks whether the local minimum instant
  falls exactly on a Monday boundary; if not (it never does here — the seed starts mid-Sunday
  everywhere), the partially-covered week is excluded and the next Monday is used instead.
- `getWeeklyLocationCounts`: `SELECT DISTINCT` dedup, `AT TIME ZONE 'UTC' AT TIME ZONE
  a.timezone` bucketing, a `generate_series` week list per account joined against every
  location with `LEFT JOIN` + `COUNT(*) FILTER (...)` per event type (zero-fills automatically —
  a location/week with no matching event still gets a row with all three counts at 0). Week
  starts come back as `text`, never a parsed `Date`, so nothing here depends on the Node
  process's own timezone.

`scripts/agg-check.ts` calls all three and **asserts** the four Done-when facts itself (throws
and exits 1 on any mismatch) rather than just printing numbers for a human to eyeball — including
a stronger zero-fill check than the raw row count: every one of the 69 locations is checked to
have all 25 distinct weeks present, not just that `rows.length` happens to equal `69 × 25`.

**All four facts reproduced exactly, on the first real run against the seeded database** — no
retries, no adjustment: as-of `2026-07-27T22:20:34Z`; every one of the 20 accounts independently
computing the same default week `2026-07-20` and earliest full week `2026-02-02`; 1725 rows, 69
locations, 25 weeks, zero gaps; totals 12,517 / 7,708 / 3,023 / 1,786; the New York case landing
on local `2026-06-02`, week of `2026-06-01`. These match every number `PLAN.md` and `TASKS.md`
already carry, produced independently through actual SQL rather than copied.

- **One typecheck failure caught before calling this done:** `rows[0].asOf` in `getAsOf` — with
  `noUncheckedIndexedAccess` on, `rows[0]` types as possibly `undefined`. Fixed with a `rows[0]!`
  plus a comment stating why it's safe (an aggregate with no `GROUP BY` always returns exactly
  one row), rather than turning the strict flag off.
- **Checked the query doesn't quietly depend on the Node process's own timezone**, since
  bucketing bugs are usually exactly this kind of thing: reran the script under
  `TZ=America/Los_Angeles` and got byte-identical output. Every timestamp the script reads comes
  back as SQL-cast `text`, never through `pg`'s default `Date`-parsing path.
- **Verified independently.** Dispatched the `witness` subagent cold with the four facts and the
  exact commands to run (including the `TZ=America/Los_Angeles` rerun and `npm run typecheck`,
  since this task added new TypeScript files); it reran all of them and confirmed every "ok:"
  line, a clean exit 0 both times, and a clean typecheck. It flagged, correctly, that it didn't
  read the SQL or the TypeScript itself — it only ran what it was asked to run and reported the
  output.
- **A gap noticed, not fixed:** `npm run typecheck` only checks the `server` and `web`
  workspaces — nothing at the repo root type-checks `scripts/*.ts` (this is also true of T3's
  `scripts/seed.ts`, unnoticed until now). `agg-check.ts` happens to be clean, but nothing would
  catch it if it weren't. Flagging rather than adding a root tsconfig unasked, since T4 didn't
  scope that in and it touches every future `scripts/` file, not just this one.

Repo changes: `server/src/db/pool.ts`, `server/src/db/aggregation.ts`, `scripts/agg-check.ts`
(all new); this log entry. No `seed/` writes.

**My call:** accepted. All four facts reproduced exactly on the first run, with no retries and
no adjustment — the SQL was written from the spec and independently produced the numbers
the plan had already measured in Python. Two paths, same answer, is the strongest evidence
this aggregation is right.

**Who was right:** (no disagreement)

---

## I15 — Closing the typecheck gap: root `tsconfig.json` for `scripts/`

**Me:**
> Before T14: add a root tsconfig that covers scripts/ and include it in npm run typecheck.
> You were right not to absorb it into T4, but T5b adds the harness and that's the last file I
> want unchecked. Then continue with T14.

**Agent:** Added `tsconfig.json` at the repo root, extending `tsconfig.base.json`, `include:
["scripts", "migrate-config.js"]`. Root `package.json`'s `typecheck` script now runs
`tsc --noEmit -p tsconfig.json` before delegating to the workspaces.

- **Two real errors surfaced immediately, both fixed rather than suppressed:**
  1. `scripts/agg-check.ts`'s NY-timezone check destructured `nyRows[0]` directly —
     `noUncheckedIndexedAccess` correctly flags that as possibly `undefined`. Fixed the same way
     as `getAsOf` in I14: a `nyRows[0]!` plus a one-line comment on why it's safe (a literal
     `SELECT` with no `FROM` always returns exactly one row).
  2. `scripts/seed.ts` imports `migrate-config.js`, a plain-JS file with no declaration file —
     `tsc` refused with "implicitly has an 'any' type." Rather than adding a `.d.ts` or renaming
     the file (either of which reaches beyond what was asked), turned on `allowJs` in this one
     root tsconfig, scoped to exactly the files it covers; `server/` and `web/`'s own tsconfigs
     are untouched.
- **Proved the wiring isn't a no-op before calling it done**, not just that it compiles clean:
  ran `npm run typecheck` clean, then deliberately broke `scripts/agg-check.ts` with an obvious
  type error and confirmed `npm run typecheck` failed at exactly that line (`TS2322` at the
  injected line), then reverted and confirmed clean again.
- **Verified independently.** Dispatched the `witness` subagent cold with the same
  break-then-revert sequence to run itself, plus a final `agg-check.ts` run against the seeded
  database to confirm nothing about the app's actual behavior changed. It confirmed all of it,
  including a byte-for-byte diff proving its own revert was exact, and separately confirmed my
  earlier edits (the `nyRows[0]!` fix) were the only pre-existing diff on that file — nothing
  else leaked in.

Repo changes: `tsconfig.json` (new, root); `package.json` (root `typecheck` script);
`scripts/agg-check.ts` (the `nyRows[0]!` null-safety fix); this log entry.

**My call:** accepted. The part that matters isn't that the typecheck passed — it's that it
deliberately broke agg-check.ts, confirmed the typecheck failed at exactly that line,
reverted, and confirmed clean again.

**Who was right:** (no disagreement)

---

## I16 — T14: SQL + timezone integration tests

**Me:**
> Then continue with T14.

**Agent:** Chose `@testcontainers/postgresql` over the "cheaper variant" `TASKS.md` explicitly
allows (running against the developer's own `compose.yaml` database) — `PLAN.md` §5 already
named testcontainers as the proposed default, nothing has been said about cutting it, and it's
on the cut list at position #3, not taken. Went with the full path unless told otherwise.

- **Extracted `seedDatabase()` into `server/src/db/seed.ts`**, so `scripts/seed.ts` and the new
  test setup load `seed/seed.sql` through the exact same code path rather than two copies that
  could drift. Re-ran T3's own empty-database check after the refactor before trusting it (still
  20 / 12,626, still nothing in `seed/`).
- **`server/test/sql/global-setup.ts`** runs once for the whole `sql` project: starts one
  ephemeral `postgres:16` container, runs the real migration via node-pg-migrate's programmatic
  `runner()` (the same migration file T2 wrote, not a re-implementation), seeds it via the
  shared `seedDatabase()`, and hands the connection string to the test file through
  `process.env.TEST_DATABASE_URL` — fully isolated from the developer's own `compose.yaml`
  database and its `DB_PORT` workaround; confirmed by running the suite with and without
  `DB_PORT` set and getting identical results either way.
- **`server/test/sql/aggregation.test.ts`**: T4's four bullets as real assertions, plus the §12
  checks T14 names — account 20 (zero events) still gets a valid week range and causes no error,
  but contributes zero location rows; the in-progress week of 2026-07-27 never appears in the
  series or as anyone's default week. 10 tests, all passing on the first real run.
- **A version conflict, diagnosed rather than forced through:** `@testcontainers/postgresql`
  latest (12.1.0) pulls in `testcontainers@12.1.0`, which itself now requires Node ≥22.22 — this
  machine runs 22.12.0. Rather than assume the `EBADENGINE` warning was cosmetic, traced it to
  `testcontainers`'s own `undici` dependency jumping from `^7.x` to `^8.5.0` between minor
  versions, and pinned both `@testcontainers/postgresql` and `testcontainers` to `11.14.0` (the
  last line on `undici@7.x`, which only needs Node ≥20.18.1). A first attempt to pin only
  `@testcontainers/postgresql` left a stale `testcontainers@12.0.4` in the lockfile — npm
  reported the workspace "invalid" but didn't self-heal on a second `npm install`; a full
  `node_modules` + lockfile wipe and reinstall is what actually picked up the pin.
- **A moderate `npm audit` finding accepted, not silently fixed or silently ignored:** pinning to
  the 11.x line carries a known moderate advisory in `uuid` (via `dockerode` via `testcontainers`)
  — a buffer-bounds-check issue. `npm audit fix --force` would resolve it by jumping to
  `testcontainers@12.0.4`, reintroducing the Node 22.22 requirement this machine can't meet.
  This is a dev-only, test-only dependency never in the shipped app, and `uuid` here generates
  container labels, not attacker-controlled input — but it's still a real tradeoff, made visible
  here rather than buried in a `package.json` diff.
- **Retired `server/test/sql/placeholder.test.ts` from T1**, and made the `sql` project's TZ
  respect an ambient override (`env: { TZ: process.env.TZ ?? 'America/Los_Angeles' }`) instead of
  always overriding it — `unit`/`api`/`web` are untouched and still hard-pinned. Both changes
  were necessary together: T14's own Done-when needs `TZ=UTC npm test -- sql` to actually run
  under UTC, which the previous hard-pinned config silently prevented, and the retired
  placeholder's fixed assertion (`process.env.TZ === 'America/Los_Angeles'`) would have failed
  under exactly that override. T14's real tests don't assert against `process.env.TZ` at all —
  they assert on data — so they're the thing the placeholder was always a stand-in for.
- **Proved the override was real, not just accepted by the shell.** Added a temporary probe
  test printing `process.env.TZ`, confirmed it read `America/Los_Angeles` by default and
  genuinely `UTC` under the override (only visible with `--reporter=verbose`, since the default
  reporter suppresses console output from passing tests), then removed the probe before calling
  this done.
- **Verified independently.** Dispatched the `witness` subagent cold with the exact commands,
  including a check that the `TZ=UTC` run doesn't silently leak back to
  `America/Los_Angeles` anywhere in its output. It confirmed typecheck clean, `npm test -- sql`
  and its `TZ=UTC` rerun both at 1 file / 10 tests passed, identical. Its one honestly-reported
  wrinkle: the leak-check I gave it (`grep -i "America/Los_Angeles\|error"`) matched one line —
  not a leak or a failure, but the substring "error" inside the passing test's own title
  ("...without **error**ing"). The witness reported the literal grep result and flagged that the
  pattern, not the run, was at fault, rather than silently deciding it was fine.

Repo changes: `server/src/db/seed.ts` (new); `scripts/seed.ts` (refactored to use it);
`server/test/sql/global-setup.ts`, `server/test/sql/aggregation.test.ts` (new);
`server/test/sql/placeholder.test.ts` (removed); `vitest.config.ts` (`sql` project: TZ override,
`globalSetup`, `hookTimeout`); `server/package.json` and `package-lock.json`
(`@testcontainers/postgresql`, `testcontainers` pinned to `11.14.0`, `node-pg-migrate` added);
this log entry. No `seed/` writes.

**My call:** accepted — the version conflict was traced to undici rather than forced through, and
the moderate audit finding is named with its tradeoff instead of buried in a diff.

**Who was right:** (no disagreement)

---

## I17 — README: one line on the `npm audit` finding

**Me:**
> Wait, first add one line to the README's limitations: npm audit reports a moderate advisory in uuid,
> reached through dockerode via testcontainers. Not fixed because audit fix --force jumps
> testcontainers to a version requiring Node 22.22, which this Node doesn't meet. It's a
> dev-only, test-only dependency that never ships, and uuid there generates container labels,
> not attacker-controlled input.

**Agent:** Added the line to `README.md`'s "Assumptions and known limitations" list, as
dictated — the finding, why it isn't fixed, and why it's low-risk, matching I16's own reasoning
rather than a shortened paraphrase of it.

Repo changes: `README.md` (one bullet); this log entry.

**My call:** accepted

**Who was right:** (no disagreement)

---

## I18 — Chore: exact-pinned dependencies, not a task

**Me:**
> Small chore before T5b, not a task: add .npmrc with save-exact=true, and rewrite the existing ^
> and ~ ranges in every package.json to the exact versions currently in the lockfile.
> save-exact only affects future installs, so the existing ones need rewriting.
> Verify with npm ci that nothing moved.
>
> Don't add ignore-scripts, esbuild needs its postinstall and npm has no per-package allowlist.
> And note in the README that this is about reproducible installs, not supply chain hardening.
>
> Framing for the log: this wasn't in T1's scope and isn't a missed task, it's a decision I'm
> making now, once there were enough dependencies for it to matter.

**Agent:** A repo-wide decision, not a `TASKS.md` item — logged as one because CLAUDE.md says to
log every exchange that changes something, not because it belongs on the task list.

- **`.npmrc`** with exactly `save-exact=true`. No `ignore-scripts`, as told — left it out rather
  than adding and then explaining it away, since the reasoning (esbuild's postinstall, no
  per-package allowlist) was already given.
- **Every `^`/`~` rewritten to the exact version already in `package-lock.json`,** in the root,
  `server/`, and `web/` `package.json` files — checked against the lockfile's resolved versions
  first rather than assumed, though in this case every range still matched its resolved version
  exactly (no dependency had drifted since it was pinned), so the rewrite was a straight `^`
  strip, not a version bump.
- **Verified `npm ci` first, then verified the pin mechanism itself, not just its output.**
  `npm ci` reported the same resolved versions as before (checked against `npm ls --depth=0` and
  per-workspace). That only proves the *rewrite* didn't move anything — it doesn't prove
  `save-exact` itself works, so before calling this done: installed a throwaway package
  (`tiny-invariant`) with no version specified, confirmed npm wrote `"1.3.3"` with no `^`, then
  `npm uninstall`ed it and reran `npm ci` to confirm the repo was back to exactly its prior state
  with nothing left over.
- **Verified independently.** Dispatched the `witness` subagent cold to reread all three
  `package.json` files plus `.npmrc`, rerun `npm ci`, cross-check every `npm ls` version against
  every package.json version string, rerun `npm run typecheck` and the full `npm test`, and
  confirm `ignore-scripts` is absent. All matched. It also flagged, correctly, that it took
  "Test Files 4 passed (4)" as evidence of four Vitest projects without independently rereading
  `vitest.config.ts` to confirm that count means projects rather than just files — a fair
  distinction, and this repo's four test files are one per project, so the two readings agree
  here, but the witness was right not to assume that without checking.
- **README note added exactly as dictated:** reproducible installs, not supply-chain hardening —
  a version pin doesn't vet what a package does, only that it doesn't silently change under you.

Repo changes: `.npmrc` (new); `package.json`, `server/package.json`, `web/package.json`
(ranges rewritten to exact versions); `package-lock.json`; `README.md` (one bullet); this log
entry.

**My call:** accepted — it verified the pin mechanism, not just the current state: installed a
package with no version to confirm save-exact writes exact, then reverted cleanly.

**Who was right:** (no disagreement)

---

## I19 — T5b: the measurement harness and CDF fixture

**Me:**
> Great, now onto T5b

**Agent:** Ported the D8 trim path and the §4 gate into `scripts/measure-anchor.py`, a second,
independent implementation that parses `seed/seed.sql` directly — never Postgres, never the
TypeScript — so it can't inherit T4's bugs and stay blind to the exact failure it exists to
catch.

- **Parsing:** two regexes over `seed/seed.sql`'s regular, one-INSERT-per-line format (confirmed
  first, not assumed, that no field contains an escaped quote). Dedup on every column but `id`.
- **Week ranges, replicated from `server/src/db/aggregation.ts`, not re-derived from scratch:**
  same global-min/max-converted-per-timezone logic, same Monday-boundary edge case. Matched on
  the first run: 20 accounts, 12,626 raw → 12,614 deduped, as-of `2026-07-27 22:20:34`, every
  account converging on the same 25-week range `2026-02-02`..`2026-07-20` — independently
  reproducing T4/T14's numbers through a completely different code path and language.
- **The gate (D13):** trimmed-mean baseline, `NegBin(r=10m, p=10/(10+w))` via `scipy.stats.nbinom`
  — confirmed algebraically first that `r=10m, p=10/(10+w)` gives scipy's own mean formula
  `r(1-p)/p = wm`, matching PLAN.md §4's "whose mean is w·m" before trusting any output. A
  brute-force search implements the off-by-one-corrected usual-range definition (log I7's
  erratum), not the original wrong sentence.
- **One real bug caught before trusting anything downstream.** The first full run gave the three
  account-level examples exactly right, but the location-level checks were wildly wrong (14/15
  spike locations, hundreds of location flags instead of 4/4/9). Traced it to `gate()` being
  handed a single week's count as `x` for the location gate's 4-week window, instead of the
  window's own 4-week sum — account-level checks passed by coincidence, since `w=1` there, and a
  single week already *is* its own 1-week window. Fixed by moving the window-sum computation
  inside `gate()` itself, so a caller can no longer pass a single week where a multi-week sum
  belongs. After the fix, all seven anchor facts matched on the next run: 15/15 flagged up, 0
  echo drops, location flags 4/4/9 and 4/3/9 renderable, verdict flags 10/5/3 of 246.
- **Excluding account 20 from the verdict-flags denominator, and why "quiet" isn't enough.**
  Account 20 has zero events ever; the raw gate formula, applied naively, would call it "quiet"
  every week forever (a near-zero floored baseline against zero observed never crosses either
  threshold) — which would inflate the denominator from `19×13−1=246` to `20×13−1=259` without
  ever changing the flag counts, silently breaking the published anchor. `gate()` now also checks
  `has_any_event`, `not_enough_history` cells are excluded from every rate calculation, and
  account 20 is excluded from the verdict-flags loop for exactly that reason, not just "20 has no
  events so skip it" without explaining why the raw formula alone doesn't already handle it.
- **A mistake caught on review, not by a test, before this was called done:** the first version
  of `expected-anchor.json` had its `examples` block built from hard-coded literals matching the
  Done-when's own numbers, not from the variables the script had just computed — meaning a real
  regression later would never show up as a diff, defeating the entire point of §12's "a changed
  count is re-measured, not adjusted by hand." Rewrote it to thread the actual `named_example()`
  return values through, then confirmed reruns are still byte-for-byte deterministic (no
  randomness leaking in from set/dict ordering or floating-point formatting).
- **`scripts/gen-nbinom-fixture.py`** absorbs the old T6: one committed script, one scipy call,
  producing `scripts/nbinom-fixture.json` (360 cases) for T5 to check `@stdlib`'s CDF against.
  Deliberately independent of `measure-anchor.py` — doesn't import from it or reuse its computed
  baselines, so a bug in one script's parameter-building can't hide inside the other's. Includes
  120 cases with a deliberately fractional `r` (values D8's own formula, the mean of 10 integers,
  can never produce on this seed) because the CDF library must be correct for any real-valued
  baseline the gate might someday see, not just the ones this dataset happens to hit.
- **Linted with `ruff` before calling this done** (`uv run --with ruff ruff check`), not just
  run once and left — caught a naive-datetime warning (deliberate here; annotated why rather
  than silenced blindly), one truly-unused variable, and two `sorted(...)[0]` calls that should
  have been `min(...)`.
- **Verified independently.** Dispatched the `witness` subagent cold with the seven facts and the
  exact commands, including a determinism rerun and a direct read of the `examples` block's
  source to confirm it traces to computed variables, not literals repeated a second time (the
  exact mistake caught above, checked again from the outside). All seven facts matched, the
  rerun was byte-identical, and the source-level check confirmed no literals had crept back in.

Repo changes: `scripts/measure-anchor.py`, `scripts/gen-nbinom-fixture.py`,
`scripts/expected-anchor.json`, `scripts/nbinom-fixture.json` (all new); this log entry. No
`seed/` writes, no application code.

**My call:** accepted — it caught its own fixture hard-coding the expected answers, which would
have made every future regression invisible, and a window-sum bug the account-level checks
passed over by coincidence.

**Who was right:** (no disagreement)

---

## I20 — T5: the gate library, pure TypeScript

**Me:**
> Great catches, continue with T5.

**Agent:** `server/src/gate.ts`: `trimmedMean`, `classify`, `evaluateWindow`, `usualRange` — no
database, no imports outside `@stdlib/stats-base-dists-negative-binomial-cdf`. `usualRange` is
built directly on top of `classify` (brute-forcing `lo`/`hi` by calling the real gate function
in a loop), not a separate closed-form recomputation of the range — the same defense-in-depth
the §4 erratum (log I7) exists to check for, built into the implementation itself, not just the
test.

- **Verified against T5b's proven-correct numbers before writing a single test,** not just typed
  the formula and hoped: called `usualRange(43.9, 1, 1)` and `usualRange(11.1, 1, 1)` directly
  (via a throwaway script, deleted after) and got `[31, 58]` and `[5, 18]` — the exact figures
  T5b's independent Python harness already measured, on the first try, with an implementation
  that scans via `classify` rather than a literal port of the Python's raw-CDF loop. Two
  different mechanisms, same answer, is what "independent" is for.
- **Tests pin all seven things T5 lists**, one `describe` block per item: trimmed-mean tie
  handling (a constructed case where naively dropping "every week equal to the min/max" would
  remove three weeks instead of two, catching that specific bug class); the 15/16-week and
  12/13-week history boundaries for location and account; the floor (`m` staying at 0.1,
  asserting `r=1` directly rather than only the floored `typical`); `usualRange`
  self-consistency across six `(m, w, k)` cases, brute-forced against `classify` itself; one
  constructed case that flags at `k=1` and is quiet at `k=15`; and the fixture-agreement check
  reading `scripts/nbinom-fixture.json` directly and comparing every one of its 360 rows against
  `@stdlib`'s own CDF — measured at 4.06e-14 max relative error, the same order of magnitude as
  E7's original 3.2e-14, well inside the 1e-10 safety margin.
- **Verified independently, and it found a real gap before I did.** Dispatched the `witness`
  subagent cold with the seven items and told it to read the test file itself and judge whether
  each assertion actually matches its claim, not just that a plausibly-named test exists. It
  confirmed six of seven cleanly, and on the floor test it correctly flagged that asserting
  `typical === 0.1` only *implies* `r = 1` through `classify`'s formula — the test never checked
  `r` itself. Fixed by adding a direct `expect(10 * result.typical).toBe(1)`, re-verified
  (typecheck clean, same 16/16 tests passing), rather than dismissing the distinction as pedantic.

Repo changes: `server/src/gate.ts`, `server/test/unit/gate.test.ts` (new);
`server/package.json` and `package-lock.json` (`@stdlib/stats-base-dists-negative-binomial-cdf`
added); this log entry. No `seed/` writes.

**My call:** accepted — usualRange brute-forces through classify instead of recomputing the range,
so the §4 off-by-one class can't recur in the implementation itself, not just in the test.

**Who was right:** the witness — it caught that the floor test only implied r=1 through classify's
formula rather than asserting it. I'd have missed that.

---

## I21 — T7: `weeklyCheck()`, SQL + gate → the §6 response

**Me:**
> Nice catch from the witness, continue with T7 as per dependency order.

**Agent:** `server/src/weeklyCheck.ts`: one function, `(pool, accountId, eventType, weekStart) =>`
the §6 object — `asOf`, `week`, `weeks`, `account`, `verdict`, and `locations` (omitted per D16).
Reuses T4's `getAsOf`/`getAccountWeekRanges`/`getWeeklyLocationCounts` and T5's
`evaluateWindow`/`usualRange` directly rather than re-querying or re-deriving anything; added
one small `getAccounts` to `aggregation.ts` for account id/name, in the same reuse-and-filter
style as everything else here. Added `scripts/check.ts`, the literal CLI T7's Done-when asks for.

- **A real bug, caught by actually running it against the database, not by reasoning about the
  code.** Account 20 — zero events, ever — came back `"quiet"` instead of `"not_enough_history"`.
  This is exactly the theoretical edge case flagged while designing T5b's verdict-flags
  exclusion (log I19): an all-zero series floors `m` at 0.1, and `x=0` against that baseline
  crosses neither threshold, so the raw calendar-only check calls it quiet forever. I'd built the
  guard into the *Python oracle* at the time but never carried it into the TypeScript gate
  itself — T5's own tests never exercised it because none of T5's fixtures were "plenty of
  calendar weeks, entirely zero." Fixed at the source: `evaluateWindow` now takes an optional
  `hasAnyEvent` parameter (default `true`, so every existing call site and test stays valid),
  short-circuiting to `not_enough_history` regardless of the calendar check when false. Added a
  unit test pinning both branches (`quiet` without the flag, `not_enough_history` with it) so
  this doesn't silently regress the next time someone touches the gate. `weeklyCheck()` passes
  `hasAnyEvent = locationCount > 0`, which is already-computed, not a second query.
- **One generalization made, not asked for, flagged here rather than silently baked in:** D16
  says single-site accounts get no `locations` key. Account 20 has *zero* locations, which D16
  never names — I extended the omission to `locationCount < 2` (covers both 1 and 0) rather than
  leave account 20 with a technically-valid but degenerate `{flagged: [], notEnoughHistory: [],
  quietCount: 0}` object. Reasoned it's a minimal, defensible reading of the same rule rather
  than a departure from it, but it's still a call outside what T7 or D16 explicitly says, so
  naming it here rather than treating it as obviously correct.
- **All seven Done-when cases matched exactly** on account-verdict fields — including
  `changePct` values I hadn't cross-checked against anything before running them (`-73`, `45`,
  `-100`) landing exactly on the percentages `§7`'s prose already uses ("about 73% below",
  "about 45% above", "no leads at all") — and account 6's location breakdown reproduced Site N's
  exact `count: 40, usualRange: [2, 24]` from `PLAN.md` §6/§7 without that example being consulted
  while writing the code.
- **Two things simplified on purpose, both documented in code comments, not hidden:**
  `weeklyCheck()` calls T4's account-wide, all-account aggregation functions on every single
  request rather than adding parametrized-by-account SQL variants — correct, and fine at this
  dataset's scale, but a real inefficiency if this ever mattered at scale. `asOf` needed a
  one-line reformat (`getAsOf`'s `::text` cast avoids `pg`'s `Date`-parsing pitfall but leaves a
  space instead of `T`/`Z`) — caught by comparing my first real run's output against `PLAN.md`
  §6's example format, not assumed correct from the type signature.
- **Verified independently.** Dispatched the `witness` subagent cold with all seven cases and
  the exact expected values, plus a full typecheck and test-suite rerun. All seven matched,
  including the two no-`locations`-key checks done programmatically (not just visual
  inspection), and both `npm run typecheck` and `npm test` came back clean.

Repo changes: `server/src/weeklyCheck.ts`, `scripts/check.ts` (new); `server/src/gate.ts`
(`hasAnyEvent` parameter); `server/src/db/aggregation.ts` (`getAccounts`);
`server/test/unit/gate.test.ts` (new test for the `hasAnyEvent` branch); this log entry. No
`seed/` writes.

**My call:** accepted — fixed at the source with a default that keeps every existing call site
valid, and pinned both branches with a test. Flagged the D16 extension instead of baking it in.

**Who was right:** (no disagreement)

---

## I22 — D16 extension confirmed (no PLAN.md edit); new CLAUDE.md rule on the two gates

**Me:**
> Two things, then T15.
>
> D16: yes, extend it to locationCount < 2. Just do not modify the PLAN since we are already on
> implementing phase and that's against the exercise.
>
> Add a rule to CLAUDE.md: there are two implementations of the gate, the Python oracle and
> the TypeScript. A fix in one is not a fix. Whenever either changes, state explicitly whether
> the other needs the same change. Three entries now have had them drift, I19 the harness, I21
> the TypeScript, and the anchor test can't see it.

**Agent:**

- **D16's generalization from I21 is confirmed as-is, with no `PLAN.md` change.** The code
  already implements `locationCount < 2`; nothing to touch there. Noted for the record: this is
  a deliberate departure from the errata/addition/reversal categorization I7 established for
  `PLAN.md` itself — that rule governed fixing the *plan's own text* before implementation
  started. Now that implementation is underway, ambiguous-but-reasonable judgment calls like
  this one get settled in `ai-log/implementation.md` only; `PLAN.md` stays exactly as closed on
  2026-09-17, full stop, per the exercise's own structure.
- **Added `CLAUDE.md` rule 4**, after rule 3, in the same voice as the others: whenever
  `scripts/measure-anchor.py` or `server/src/gate.ts` changes, state explicitly whether the
  other needs the same change, and why or why not. Named I19 and I21 as the two entries that
  already drifted, and named the actual reason nothing caught it in between: T15 (the
  regression anchor that would run against both) doesn't exist yet.
- **Checked, not assumed, that both implementations agree right now.** Reread
  `measure-anchor.py`'s `gate()` — it already takes `has_history` and short-circuits to
  `not_enough_history` when false, wired through `account_gate` via
  `account_id in has_any_event`, from I19. That already matches I21's TypeScript fix; there is
  no live drift to correct today. The new rule is about the next change, not a backlog item.

Repo changes: `CLAUDE.md` (rule 4 added); this log entry. No `PLAN.md`, no `seed/` writes, no
application code.

**My call:** accepted — it verified both implementations actually agree today instead of letting a
new rule imply a backlog, and it drew the line on PLAN.md edits correctly.

**Who was right:** me — editing PLAN.md mid-implementation is exactly the retrofitting the brief
warns against. The erratum/addition/reversal rule governed the plan's text before code existed,
not after.
