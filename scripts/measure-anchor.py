#!/usr/bin/env python3
"""
The measurement harness (T5b) — a committed, independent second implementation of D8's
trimmed-mean baseline and the §4 negative-binomial gate.

It parses seed/seed.sql directly and never touches Postgres or the TypeScript: if it queried
the database through the app's own aggregation SQL it would inherit that code's bugs, and the
cross-check would be blind to exactly the failure it exists to catch (PLAN.md §12: "a changed
count is re-measured, not adjusted by hand").

Run with:  uv run --with scipy,numpy,tzdata scripts/measure-anchor.py
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from scipy.stats import nbinom

REPO_ROOT = Path(__file__).resolve().parent.parent
SEED_PATH = REPO_ROOT / "seed" / "seed.sql"
EXPECTED_ANCHOR_PATH = Path(__file__).resolve().parent / "expected-anchor.json"

EVENT_TYPES = ("call_received", "lead_created", "appointment_set")
SINGLE_SITE_ACCOUNTS = {8, 13, 16, 19}

# D13 gate constants (PLAN.md §4).
BASELINE_WEEKS = 12
FLOOR_M = 0.1

ACCOUNT_RE = re.compile(
    r"^INSERT INTO accounts \([^)]*\) VALUES "
    r"\((\d+), '([^']*)', '([^']*)', '([^']*)', '([^']*)'\);$"
)
EVENT_RE = re.compile(
    r"^INSERT INTO activity_events \([^)]*\) VALUES "
    r"\((\d+), (\d+), '([^']*)', '([^']*)', '([^']*)', (NULL|-?\d+), (NULL|'[^']*')\);$"
)


@dataclass(frozen=True)
class Account:
    id: int
    name: str
    industry: str
    timezone: str
    created_at: str


@dataclass(frozen=True)
class Event:
    account_id: int
    location: str
    event_type: str
    occurred_at: datetime  # naive, UTC
    duration_seconds: str
    outcome: str


def parse_seed() -> tuple[list[Account], list[Event]]:
    accounts: list[Account] = []
    events: list[Event] = []
    with SEED_PATH.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            m = ACCOUNT_RE.match(line)
            if m:
                accounts.append(
                    Account(
                        id=int(m.group(1)),
                        name=m.group(2),
                        industry=m.group(3),
                        timezone=m.group(4),
                        created_at=m.group(5),
                    )
                )
                continue
            m = EVENT_RE.match(line)
            if m:
                events.append(
                    Event(
                        account_id=int(m.group(2)),
                        location=m.group(3),
                        event_type=m.group(4),
                        # Deliberately naive: seed/schema.sql's `timestamp` column is UTC with
                        # no offset stored, and `to_local()` below attaches UTC explicitly.
                        occurred_at=datetime.strptime(m.group(5), "%Y-%m-%d %H:%M:%S"),  # noqa: DTZ007
                        duration_seconds=m.group(6),
                        outcome=m.group(7),
                    )
                )
    return accounts, events


def dedup(events: list[Event]) -> list[Event]:
    seen: dict[tuple, Event] = {}
    for e in events:
        key = (e.account_id, e.location, e.event_type, e.occurred_at, e.duration_seconds, e.outcome)
        seen.setdefault(key, e)
    return list(seen.values())


def week_start(d: date) -> date:
    return d - timedelta(days=d.weekday())


def to_local(dt_utc: datetime, tz: ZoneInfo) -> datetime:
    return dt_utc.replace(tzinfo=ZoneInfo("UTC")).astimezone(tz)


def main() -> int:
    accounts, raw_events = parse_seed()
    events = dedup(raw_events)

    print(f"accounts parsed: {len(accounts)}")
    print(f"events parsed (raw): {len(raw_events)}")
    print(f"events after dedup: {len(events)}")

    global_min = min(e.occurred_at for e in events)
    global_max = max(e.occurred_at for e in events)
    print(f"as-of (global max occurred_at): {global_max}")
    print(f"global min occurred_at: {global_min}")

    tz_by_account = {a.id: ZoneInfo(a.timezone) for a in accounts}

    # Per-account full-week range, from the *global* min/max converted into that account's own
    # timezone — matches server/src/db/aggregation.ts exactly, not a fresh derivation.
    week_lists: dict[int, list[date]] = {}
    for a in accounts:
        tz = tz_by_account[a.id]
        local_min = to_local(global_min, tz)
        local_max = to_local(global_max, tz)
        local_min_week = week_start(local_min.date())
        if local_min == datetime.combine(local_min_week, datetime.min.time(), tzinfo=tz):
            earliest_full_week = local_min_week
        else:
            earliest_full_week = local_min_week + timedelta(days=7)
        default_week = week_start(local_max.date()) - timedelta(days=7)

        weeks = []
        w = earliest_full_week
        while w <= default_week:
            weeks.append(w)
            w += timedelta(days=7)
        week_lists[a.id] = weeks

    default_weeks = {w[-1] for w in week_lists.values() if w}
    earliest_weeks = {w[0] for w in week_lists.values() if w}
    print(f"default week (all accounts): {sorted(str(w) for w in default_weeks)}")
    print(f"earliest full week (all accounts): {sorted(str(w) for w in earliest_weeks)}")
    print(f"weeks per account: {sorted({len(w) for w in week_lists.values()})}")

    week_index: dict[int, dict[date, int]] = {
        aid: {w: i for i, w in enumerate(weeks)} for aid, weeks in week_lists.items()
    }

    # Zero-filled weekly series, one per (account, location, event_type). The account-level
    # series (below) is this series' own sum across locations, not a separate tally, so the two
    # can never disagree with each other by construction.
    locations_by_account: dict[int, set[str]] = defaultdict(set)
    has_any_event: set[int] = set()
    location_counts: dict[tuple[int, str, str, date], int] = defaultdict(int)
    for e in events:
        weeks = week_lists.get(e.account_id)
        if not weeks:
            continue
        tz = tz_by_account[e.account_id]
        local_date = to_local(e.occurred_at, tz).date()
        ws = week_start(local_date)
        idx = week_index[e.account_id].get(ws)
        if idx is None:
            continue  # the in-progress week, or (structurally impossible here) before range start
        locations_by_account[e.account_id].add(e.location)
        has_any_event.add(e.account_id)
        location_counts[(e.account_id, e.location, e.event_type, ws)] += 1

    def series_for(account_id: int, location: str, event_type: str) -> list[int]:
        weeks = week_lists[account_id]
        return [location_counts.get((account_id, location, event_type, w), 0) for w in weeks]

    account_series: dict[tuple[int, str], list[int]] = {}
    for a in accounts:
        weeks = week_lists[a.id]
        for et in EVENT_TYPES:
            total = [0] * len(weeks)
            for loc in locations_by_account[a.id]:
                s = series_for(a.id, loc, et)
                total = [x + y for x, y in zip(total, s)]
            account_series[(a.id, et)] = total

    n_locations = sum(len(locs) for locs in locations_by_account.values())
    print(f"distinct (account, location) pairs: {n_locations}")

    post_dedup_totals = {et: sum(sum(account_series[(a.id, et)]) for a in accounts) for et in EVENT_TYPES}
    post_dedup_total = sum(post_dedup_totals.values())
    print(f"post-dedup totals over the full weeks: {post_dedup_total} "
          f"({post_dedup_totals['call_received']} calls, {post_dedup_totals['lead_created']} leads, "
          f"{post_dedup_totals['appointment_set']} appointments)")

    # --- The gate (D13 / PLAN.md §4) ---

    def trimmed_mean(weekly_counts: list[int]) -> float:
        trimmed = sorted(weekly_counts)[1:-1]
        return max(sum(trimmed) / len(trimmed), FLOOR_M)

    def gate(series: list[int], eval_index: int, w: int, k: int, has_history: bool):
        """Returns (state, m, x). state in {'flagged_up','flagged_down','quiet','not_enough_history'}.
        `x` is the w-week window's own total, ending at (and including) `eval_index` — computed
        here, not by the caller, so a caller can never pass a single week's count by mistake
        where a multi-week window sum belongs."""
        i0 = eval_index - w + 1
        if not has_history or i0 - BASELINE_WEEKS < 0:
            return "not_enough_history", None, None
        x = sum(series[i0 : eval_index + 1])
        baseline = series[i0 - BASELINE_WEEKS : i0]
        m = trimmed_mean(baseline)
        r = 10 * m
        p = 10 / (10 + w)
        dist = nbinom(r, p)
        alpha = 0.05 / (2 * k)
        if dist.cdf(x) < alpha:
            return "flagged_down", m, x
        if 1 - dist.cdf(x - 1) < alpha:
            return "flagged_up", m, x
        return "quiet", m, x

    def usual_range(m: float, w: int, k: int) -> tuple[int, int]:
        r = 10 * m
        p = 10 / (10 + w)
        dist = nbinom(r, p)
        alpha = 0.05 / (2 * k)
        lo = 0
        while dist.cdf(lo) < alpha:
            lo += 1
        hi = lo
        while 1 - dist.cdf(hi) >= alpha:
            hi += 1
        return lo, hi

    failures: list[str] = []

    def check(condition: bool, message: str) -> None:
        status = "ok" if condition else "FAILED"
        print(f"{status}: {message}")
        if not condition:
            failures.append(message)

    check(
        len(default_weeks) == 1 and len(earliest_weeks) == 1
        and next(iter(default_weeks)) == date(2026, 7, 20)
        and next(iter(earliest_weeks)) == date(2026, 2, 2)
        and {len(w) for w in week_lists.values()} == {25},
        "every account: 25 full weeks, 2026-02-02 .. 2026-07-20",
    )

    check(
        len(events) == 12614 and post_dedup_total == 12517
        and post_dedup_totals["call_received"] == 7708
        and post_dedup_totals["lead_created"] == 3023
        and post_dedup_totals["appointment_set"] == 1786,
        "12,614 events after dedup; 12,517 in the 25 full weeks (7,708 / 3,023 / 1,786)",
    )

    def account_gate(account_id: int, event_type: str, week: date, w: int, k: int):
        series = account_series[(account_id, event_type)]
        idx = week_index[account_id].get(week)
        if idx is None:
            raise ValueError(f"{week} is not an evaluable week for account {account_id}")
        return gate(series, idx, w, k, account_id in has_any_event)

    def location_gate(account_id: int, location: str, event_type: str, week: date, w: int, k: int):
        series = series_for(account_id, location, event_type)
        idx = week_index[account_id][week]
        return gate(series, idx, w, k, True)

    # --- The three named examples ---

    def named_example(account_id: int, event_type: str, week_str: str):
        week = date.fromisoformat(week_str)
        # The account verdict always uses w=1, k=1 (D10).
        state, m, x = account_gate(account_id, event_type, week, w=1, k=1)
        lo, hi = usual_range(m, 1, 1) if m is not None else (None, None)
        return x, state, m, lo, hi

    x6, state6, m6, lo6, hi6 = named_example(6, "call_received", "2026-06-01")
    ratio6 = round(x6 / m6, 2) if m6 else None
    check(
        x6 == 528 and state6 == "flagged_up" and round(m6, 1) == 43.9 and (lo6, hi6) == (31, 58) and ratio6 == 12.03,
        f"account 6 calls 2026-06-01 -> {x6}, {state6}, typical {round(m6, 1)}, usual [{lo6}, {hi6}], {ratio6}x",
    )

    x7, state7, m7, lo7, hi7 = named_example(7, "call_received", "2026-07-13")
    check(
        x7 == 3 and state7 == "flagged_down" and round(m7, 1) == 11.1 and (lo7, hi7) == (5, 18),
        f"account 7 calls 2026-07-13 -> {x7}, {state7}, typical {round(m7, 1)}, usual [{lo7}, {hi7}]",
    )

    x1, state1, _m1, lo1, hi1 = named_example(1, "call_received", "2026-07-20")
    check(
        x1 == 34 and state1 == "quiet" and (lo1, hi1) == (20, 42),
        f"account 1 calls 2026-07-20 -> {x1}, {state1}, usual [{lo1}, {hi1}]",
    )

    # --- Account 6, 2026-06-01: 15/15 locations flagged up; 0 echo drops afterwards ---

    account_6_locations = sorted(locations_by_account[6])
    up_count = 0
    for loc in account_6_locations:
        state, _, _ = location_gate(6, loc, "call_received", date(2026, 6, 1), w=4, k=len(account_6_locations))
        if state == "flagged_up":
            up_count += 1
    check(up_count == 15 and len(account_6_locations) == 15, f"{up_count}/15 account-6 locations flagged up on 2026-06-01")

    echo_drops = 0
    for et in EVENT_TYPES:
        for loc in account_6_locations:
            for week in week_lists[6][15:]:  # every location-evaluable week
                state, _, _ = location_gate(6, loc, et, week, w=4, k=len(account_6_locations))
                if state == "flagged_down":
                    echo_drops += 1
    check(echo_drops == 0, f"{echo_drops} echo drop(s) for account-6 locations on any event type, any evaluable week")

    # --- Location flags excluding account 6 (gate-level and renderable) ---

    location_flags_gate = {et: 0 for et in EVENT_TYPES}
    location_flags_renderable = {et: 0 for et in EVENT_TYPES}
    for a in accounts:
        if a.id == 6:
            continue
        locs = sorted(locations_by_account[a.id])
        k = len(locs)
        if k == 0:
            continue
        for et in EVENT_TYPES:
            for loc in locs:
                for week in week_lists[a.id][15:]:
                    state, _, _ = location_gate(a.id, loc, et, week, w=4, k=k)
                    if state in ("flagged_up", "flagged_down"):
                        location_flags_gate[et] += 1
                        if a.id not in SINGLE_SITE_ACCOUNTS:
                            location_flags_renderable[et] += 1

    check(
        [location_flags_gate[et] for et in EVENT_TYPES] == [4, 4, 9],
        f"location flags excluding account 6, gate level: {[location_flags_gate[et] for et in EVENT_TYPES]}",
    )
    check(
        [location_flags_renderable[et] for et in EVENT_TYPES] == [4, 3, 9],
        f"location flags excluding account 6, renderable: {[location_flags_renderable[et] for et in EVENT_TYPES]}",
    )

    # --- Verdict flags: 19 accounts (20 has no history at all) x 13 weeks, minus the one
    # account-6 / 2026-06-01 cell that's masked out of the anchor, not the rest of account 6 ---

    masked_cell = (6, date(2026, 6, 1))
    verdict_flags = {et: 0 for et in EVENT_TYPES}
    total_cells = 0
    for a in accounts:
        if a.id == 20:
            continue  # never has a single event; excluded from this anchor, not silently "quiet"
        for week in week_lists[a.id][12:]:
            if (a.id, week) == masked_cell:
                continue
            total_cells += 1
            for et in EVENT_TYPES:
                state, _, _ = account_gate(a.id, et, week, w=1, k=1)
                if state in ("flagged_up", "flagged_down"):
                    verdict_flags[et] += 1

    check(total_cells == 246, f"246 evaluated verdict cells (19 accounts x 13 weeks, minus the masked cell), got {total_cells}")
    check(
        [verdict_flags[et] for et in EVENT_TYPES] == [10, 5, 3],
        f"verdict flags: {[verdict_flags[et] for et in EVENT_TYPES]} of {total_cells}",
    )

    anchor = {
        "asOf": global_max.isoformat() + "Z",
        "defaultWeek": min(str(w) for w in default_weeks),
        "earliestFullWeek": min(str(w) for w in earliest_weeks),
        "fullWeekCount": len(next(iter(week_lists.values()))),
        "dedup": {
            "raw": len(raw_events),
            "deduped": len(events),
            "postDedupTotal": post_dedup_total,
            "postDedupByType": post_dedup_totals,
        },
        "examples": {
            "account6CallsW20260601": {
                "count": x6, "typical": round(m6, 1), "usualRange": [lo6, hi6], "ratio": ratio6,
            },
            "account7CallsW20260713": {
                "count": x7, "typical": round(m7, 1), "usualRange": [lo7, hi7],
            },
            "account1CallsW20260720": {"count": x1, "usualRange": [lo1, hi1]},
        },
        "account6Spike": {"locationsFlaggedUp": up_count, "of": len(account_6_locations), "echoDrops": echo_drops},
        "locationFlagsExcludingAccount6": {"gate": location_flags_gate, "renderable": location_flags_renderable},
        "verdictFlags": {"flags": verdict_flags, "of": total_cells},
    }
    EXPECTED_ANCHOR_PATH.write_text(json.dumps(anchor, indent=2) + "\n", encoding="utf-8")
    print(f"\nwrote {EXPECTED_ANCHOR_PATH.relative_to(REPO_ROOT)}")

    if failures:
        print(f"\n{len(failures)} check(s) FAILED:")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("\nAll checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
