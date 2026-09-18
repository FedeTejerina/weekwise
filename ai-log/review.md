# Review log — reviewing DASH-247

Appended as the session runs. Entries are never rewritten, merged or tidied afterwards; where I
was the one who got it wrong, the entry stays as it happened.

**Started:** 2026-09-18
**Models:** Claude Code, Opus 5 for the review; the implementation under review ran on Sonnet.
**Language:** prompts are in English, exactly as typed. Nothing here is translated or reworded.

Who writes which half of an entry is in [`README.md`](README.md), along with the reflection.

Planning entries E1–E10 are in [`planning.md`](planning.md) and implementation entries I1– are in
[`implementation.md`](implementation.md). Review entries start at R1.

---

## R1 — Code review of `server/`, `web/` and `scripts/`

**Me:**
> server web scripts Context so you don't redo work: the numbers are already verified three ways. A Python oracle that reproduces the published anchor independently, SQL integration tests against a real Postgres, and a regression anchor through the production path. The §7 wording is pinned verbatim, the rendered states have component tests and browser screenshots, and typecheck and lint are clean. So don't re-verify the arithmetic. Look for what none of that covers: - Correctness bugs the tests can't see. error paths, what happens when a query returns nothing it expected, unhandled rejections, resource leaks. - Anything that contradicts a decision in PLAN.md. The plan is closed; if code and plan disagree, that's a finding, not a suggestion to change the plan. - SQL parameterisation — CLAUDE.md says interpolating values into a query string is a defect. - Dead code, duplicated logic, anything that drifted between the two gate implementations. - The API's validation and fallback path (D15): invalid or out-of-range params must fall back to defaults, never 400. Rank findings by severity. I'm at the end of a fixed budget, so I'll fix the real ones and document the rest as known and deliberate, tell me which is which rather than assuming I'll take them all. This is the review phase, so it gets its own log: create ai-log/review.md with the same header fields the other two have, number its entries R1 onward, add a row for it to the table in ai-log/README.md, and add a third row to CLAUDE.md rule 2's table. Then log this review there — the findings, and which ones I decided to fix versus document. Models line for that file: this session is Opus; the implementation ran on Sonnet.

**Agent:** Read every file under `server/src`, `web/src` and `scripts/`, plus the migration,
`PLAN.md` §3–§12 and the relevant implementation entries (I3, I28). I did not re-verify the
arithmetic. Two findings were confirmed against the running Compose database (port 5433) with a
throwaway `app.inject()` probe, deleted afterwards. The rest come from reading the code, and each
one says so.

Findings, most severe first. **Rec** is my recommendation only. Which ones get fixed is recorded
under `My call`, which I leave for you.

1. **"Nothing unusual at any of your 0 locations"** (`web/src/LocationsSection.tsx:36`).
   Every location in an account shares the same zero-filled range, so `notEnoughHistory` is
   either empty or covers every location. When it covers every location, `flagged` is empty and
   `quietCount` is 0, and the section prints the quiet line with 0 followed by the
   not-enough-history list. I confirmed this on the live DB:
   `account=6&type=call_received&week=2026-05-04` returns
   `flagged: [], notEnoughHistory: 15 names, quietCount: 0`, and so do account 1 and account 6
   at `week=2026-02-02`. That is 15 of the 25 weeks the selector offers, on every multi-site
   account. I28 said "no week in the seed exercises this distinction", which is wrong. Those
   weeks are reachable from the week control. **Rec: fix.** Render the quiet line only when
   `quietCount > 0`.
2. **The README's `npm run dev` does not exist** (`package.json`). The root has only `dev:api`,
   and `dev` lives in the `web` workspace. Running `npm run dev` at the root fails with
   `Missing script: "dev"` (I ran it). PLAN §9 and README line 48 both give this as the fourth
   setup command. **Rec: fix.** Add a root `dev` script that starts the API and Vite.
3. **The not-enough-history verdict drops §7's sentence because of a wrong premise**
   (`server/src/weeklyCheck.ts:128`). §7 says: "Not enough history yet. Judging a normal week
   takes 13 weeks of data; you have 9." I28 fell back to the short form because it believed
   the seed can't produce this state for anything the app queries. It can. Weeks 2026-02-02 to
   2026-04-20, which is `evalIndex` 0–11, are selectable for every account, and all of them
   return `not_enough_history` (confirmed for accounts 1 and 6 at 2026-02-02). The numbers are
   already available as `weeksHave = evalIndex + 1` and `weeksNeeded = 13`. Account 20 is the
   only case where the short form is actually correct. You accepted I28 on that premise, so
   this is yours to decide. **Rec: fix.** Pass both numbers through `buildVerdict` or the
   response, and keep the short form for accounts with no events at all.
4. **The `pg` Pool has no `'error'` listener** (`server/src/db/pool.ts:5`). An idle client
   that loses its connection, for example on `docker compose restart db`, emits `'error'` on
   the pool. With no listener, Node throws it and the API process exits. From reading the code;
   I did not reproduce it. **Rec: fix.** It is a one-line `pool.on('error', …)`.
5. **Rule 4 drift: which locations exist, and whether the account has any event**
   (`server/src/db/aggregation.ts:134`, `server/src/weeklyCheck.ts:232`). In the TypeScript,
   the `locations` CTE reads from `dedup` over every event, including the partial first week
   and the in-progress week. `accountHasAnyEvent` is `locationCount > 0`. The Python oracle adds
   a location, and sets `has_any_event`, only when the event lands in a full week (the
   `if idx is None: continue` comes before both). The two agree on the seed. They split when a
   location or an account has events only in the in-progress week. The TypeScript then counts
   that location in `k`, tightening α for its siblings, and gives it an all-zero series that
   reads "quiet". An account in that position gets a quiet verdict where the oracle gives
   `not_enough_history`. That is the same class of gap as I19 and I21. From reading the code;
   not reproduced. The seed doesn't have this shape. **Rec: document** as a known limitation,
   or fix both sides together under rule 4. It should not be fixed in one implementation only.
6. **A failed `/api/accounts` gets hidden** (`web/src/App.tsx:30`). If the accounts fetch
   fails, a successful weekly check then calls `setLoadError(null)` and clears the message.
   `Controls` only renders when `accounts` is set, so the page shows a verdict with no controls
   and no error. Whether this happens depends on which request finishes first. From reading the
   code. **Rec: fix** if it's cheap: keep the two errors in separate state. Otherwise document.
7. **The event-type label comes from the URL, while `data` comes from the previous request**
   (`web/src/App.tsx:53`). When the Activity control changes, `eventType` changes straight away
   but `data` is still the old type's response until the new fetch returns. The call counts
   render as, for example, "34 leads … your usual week is 20 to 42 leads". If the fetch fails,
   that stays on screen next to the error. The response has no `type` field to render from.
   **Rec: document.** In local use it lasts milliseconds. It becomes real only when a fetch
   fails.
8. **The weekly check reads the database twice per request** (`server/src/api.ts:74`).
   `/api/weekly-check` calls `fetchWeeklyCheckData` to validate the parameters, then
   `weeklyCheck()` calls it again. That is 10 queries, including the full aggregation twice.
   The week is validated against the first snapshot and evaluated against the second. If the
   data changes in between (a re-seed, or a live feed moving the as-of date past a Monday),
   `evaluateAccountWeekFromData` throws "not an evaluable week" and the request returns a 500
   instead of D15's fallback. `/api/accounts` also runs all five queries just to count
   locations. **Rec: document.** It can't happen on the static seed. The fix would be a
   `weeklyCheck` overload that takes the already-fetched `data`.
9. **An unseeded database gives a 500 on both endpoints** (`server/src/db/aggregation.ts:54`,
   `server/src/weeklyCheck.ts:166`). `getAsOf` is typed `string`, but `MAX()` over an empty
   table returns `NULL`, so `asOfText.replace` throws. `data.accounts[0]!` in `api.ts` would
   throw next. This happens after `db:migrate up` with no `db:seed`. From reading the code.
   **Rec: document.** `db:setup` always seeds.
10. **The UTC timestamp parser is pinned only in tests** (`server/src/db/pool.ts:5`). PLAN §5
    says "The timestamp type parser is pinned to UTC". Only
    `server/test/setup/pg-timestamp-parser.ts` does that. The production pool never sets it.
    Every production query currently casts to `::text`, so nothing is affected today. The
    tests run a configuration production doesn't. **Rec: document**, or move the one line into
    `pool.ts`.

**Checked and clean:**
- **SQL parameterisation.** No query takes a value at all, and nothing is interpolated.
- **D15 fallback.** Covered cases: missing, `NaN`, array-valued and unknown `account`; `type`
  outside the enum or array-valued; `week` not a string or not in the account's list. All fall
  back to the default and never return a 400. The client rewrites the URL with
  `replaceState`.
- **`usualRange`.** The TypeScript and Python loops give the same `[lo, hi]`: `classify(hi+1)
  === 'quiet'` is the same test as `1 − cdf(hi) ≥ α`.
- **`trimmedMean`, the α split and the DOWN-before-UP order** match between the two
  implementations.

Repo changes: `ai-log/review.md` (new, this entry); `ai-log/README.md` (review row in the files
table); `CLAUDE.md` (a third row in rule 2's phase table). No application code changed.

**My call:**

**Who was right:**
