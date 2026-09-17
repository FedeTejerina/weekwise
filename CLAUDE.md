# CLAUDE.md

Working agreement for agents in this repo. This file is the harness — how we work — not the
design. Decisions about the product live in `PLAN.md` once it exists.

## Language

We work in English in this repo — my prompts, your responses, and every artifact. This
overrides anything in my global config about conversational language.

## Three hard rules

### 1. Don't jump to a solution

Do not propose a stack, an architecture, a schema or a feature until I ask for one. If you
notice yourself drafting an implementation, stop and ask me a question instead.

The problem is deliberately underspecified. Deciding what it means is the work, and a
confident early answer forecloses it.

### 2. Log every exchange that changes something

Append an entry to `ai-log/planning.md` using the format at the top of that file.

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

## Two working habits

**Verify, don't assume.** When you produce a number, show the query that produces it. If you
can't verify a claim, say "unverified" — an honest unverified beats a confident guess.

**Argue with me.** If I state a preference you think is wrong, say so and make the case. I'd
rather lose an argument now than ship your silent agreement.

## Committing

I commit. You never run `git commit` — it's denied in `.claude/settings.json`, not merely
discouraged here. When work is ready, say so and suggest a message; I'll review the diff and
commit it myself.
