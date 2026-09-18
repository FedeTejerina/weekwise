# CLAUDE.md

Working agreement for agents in this repo. This file is the harness — how we work — not the
design. Decisions about the product live in `PLAN.md` once it exists.

## Language

We work in English in this repo — my prompts, your responses, and every artifact. This
overrides anything in my global config about conversational language.

## Hard rules

### 1. ~~Don't jump to a solution~~ — retired 2026-09-17 (planning log E6)

The original rule: don't propose a stack, an architecture, a schema or a feature until I ask
for one.

**Why it existed:** the problem was deliberately underspecified, and a confident early answer
would have closed off how we read it.

**Why it's retired:** we're past discovery. The reading of the problem, what the data allows,
and the product decisions are recorded in `PLAN.md`, backed by log entries E1–E6. What's needed
now is convergence.

**What replaces it:** propose concrete options, recommend one, and drive open decisions to a
close. Anything that contradicts a decision in `PLAN.md` still needs my call first; say so
rather than working around it.

### 2. Log every exchange that changes something

Append an entry to the log file for the **current phase**, using the entry format the existing
entries follow. See [`ai-log/README.md`](ai-log/README.md) for how the log is organised.

| Phase | File |
|---|---|
| Reading the problem, building `PLAN.md` | `ai-log/planning.md` — **closed 2026-09-17, do not append** |
| Implementation | `ai-log/implementation.md` |
| Review | `ai-log/review.md` |

Create the phase's file if it doesn't exist yet, with the same header fields (`Started`,
`Models`, `Language`), and add a row to the table in `ai-log/README.md`.

- **Same turn, immediately.** Never batched at the end, never reconstructed from memory.
- **Append only.** Never rewrite, merge or tidy an earlier entry, including your own.
- Record what you proposed **even when I reject it**, and quote my correction verbatim.
- Leave `My call` and `Who was right` **empty**. Whether I accepted, rejected or redirected
  you — and which of us turned out to be right — is mine to write, not yours to characterize.
- When in doubt, log it. Over-logging is cheap; a missing entry can't be reconstructed honestly.

### 3. Everything under `seed/` is read-only

`seed/seed.sql` and `seed/schema.sql` are what was handed to us. Never edit, regenerate, clean
or reformat either one — writes to `seed/` are denied in `.claude/settings.json`.

The dataset's duplicates, nulls, gaps and outliers are the material, not defects to tidy away:
everything about them is handled in queries and code.

`seed/schema.sql` is **reference, not the live schema**. The schema this project runs lives in
its own migrations; when you write the first one, note in its header that it derives from this
file and say what you adapted.

### 4. Two gate implementations — a fix in one is not a fix

`scripts/measure-anchor.py` (the oracle, T5b) and `server/src/gate.ts` (the TypeScript, T5) both
implement D8's baseline and the §4 gate independently, on purpose — that's what makes their
agreement mean something. It also means a bug can exist in one, or both, without the other
noticing.

Whenever either changes, state explicitly whether the other needs the same change, and why or
why not. Don't leave it implicit.

**Why:** three log entries already have this exact drift. I19 built a `hasAnyEvent`-style guard
into the Python oracle so account 20 (zero events ever) wouldn't be miscounted as "quiet" in the
verdict-flags anchor. I21 found the identical gap independently, the hard way, by running the
TypeScript against the database — nothing had carried the fix across. Between the two entries,
nothing checked whether the fix belonged in both places, because the thing that would catch this
automatically — T15's regression anchor, run against both implementations — doesn't exist yet.

## Two working habits

**Verify, don't assume.** When you produce a number, show the query that produces it. If you
can't verify a claim, say "unverified" — an honest unverified beats a confident guess.

**Argue with me.** If I state a preference you think is wrong, say so and make the case. I'd
rather lose an argument now than ship your silent agreement.

## Committing

I commit. You never run `git commit` — it's denied in `.claude/settings.json`, not merely
discouraged here. When work is ready, say so and suggest a message; I'll review the diff and
commit it myself.
