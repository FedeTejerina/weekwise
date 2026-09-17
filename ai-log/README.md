# AI interaction log

How this was built, entry by entry, written as it happened. Nothing here is reconstructed
after the fact and no entry has been rewritten — where I was the one who got it wrong, the
entry stays as it was.

## The files

| File | What it covers |
|---|---|
| [`planning.md`](planning.md) | Reading the problem and building `PLAN.md`. Entries E1–E10. Planning closed 2026-09-17. |

Later phases get their own file. Entry format is the same in all of them.

## Who writes what

Each entry has two halves with different authors, and that split is the reason the log is
worth reading.

The **factual half** — my prompt verbatim, what the agent proposed, what actually changed —
is appended by the agent in the same turn the exchange happens, from the exchange itself
rather than from memory.

The **`My call`** and **`Who was right`** lines are mine. Whether I accepted, rejected or
redirected, and which of us turned out to be right, is a judgment about the agent's work that
the agent doesn't get to make about itself.

So the agent can't grade itself, and I can't quietly improve my own prompts after the fact.

## Tools and models

**Claude Code, Opus 5**, for the whole planning phase — surveying the ticket, running the data
diagnostics, and drafting `PLAN.md` and the agent-context files. No other assistant was used.

I directed, challenged and decided; the agent authored and measured. I wrote no production code
by hand and I don't intend to — the division of labour is deliberate, not incidental.

_(Updated as the project moves: implementation is planned to run individual tasks on a smaller
model, since by then the acceptance criteria are written down and the judgment has already
happened.)_

## Reflection

### Where I caught the agent

- **E2 — a finding that measured nothing.** E1 listed "scattered single-location spikes and
  dips" using a rule it had never tested against chance, in the same answer where it told me
  weekly noise was large relative to the signal. I pointed at the contradiction and asked it
  to test it, without saying which test. Its rule turned out to flag the same amount on real
  data as on pure noise, and it retracted the finding.
- **E10 — the in-progress week.** The plan had the partial week only as an exclusion. Correct
  arithmetic, but it would have made the page look stale to anyone opening it mid-week.
- **E6 — the stack.** Its proposal optimised for the statistics library and ignored that the
  brief asks me to build in my strongest stack. In fairness that one is on my prompt: I asked
  for its "best option" without giving it the constraint.

### Where the agent was right and I wasn't

- **E3 — location bars.** I had planned to show each location's movement with a bar sized by
  the change. It proved the bars would mostly show noise, and that the location with the
  biggest bar changes from week to week at random.
- **E4 — the 4-week window.** I thought a longer window rescued the bars. It measured that a
  15-location account would still show at least one ≥50% bar on about 75% of Mondays from
  noise alone.
- **E8 — a rule I removed for the wrong reason.** I told it to drop a "only where volume
  allows" guard, reasoning that a calibrated test would simply not fire at low volume. That is
  backwards: at about one event a week the median baseline is biased low, so it fires *more*.
  It found this by re-measuring per event type, and raised the fix as an open decision instead
  of overriding a decision I had already accepted.

### Where it corrected itself, unprompted

- **E3** — its own over-strict threshold from E2, which had been stricter than one admin
  looking at one account.
- **E5** — its own false-flag-rate claim, mid-turn, after printing a number that assumed a
  one-sided test.
- **E7 and E9** — re-measured every number that depended on a baseline it had just changed,
  instead of leaving stale examples in the plan.

### Where I constrained it by construction rather than by asking

- `git commit` is denied in `.claude/settings.json`. The agent creates and edits; I commit.
- Everything under `seed/` is write-protected, so the provided dataset cannot be "cleaned".
- "Don't jump to a solution" held for nine entries, then was **retired explicitly** in
  `CLAUDE.md` with the original rule, why it existed and why it no longer applies. Past
  discovery it had stopped protecting the work and started preventing convergence.
