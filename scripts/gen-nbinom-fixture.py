#!/usr/bin/env python3
"""
Writes the committed CDF fixture (T5b) that T5's unit tests check the TypeScript negative
binomial CDF library against. Absorbs the old T6: this and `measure-anchor.py` are the only
two scipy invocations this repo needs.

Deliberately independent of `measure-anchor.py`: it does not import from it or reuse its
computed baselines, so a bug in one script's parameter-building can't hide inside the other's.
It generates its own grid of `(m, w, k, x)` cases, including non-integer `r = 10*m` values the
seed itself never produces (D8's baseline is always a multiple of 0.1, since it's the mean of
10 integers) — because T5's gate implementation, and the CDF library underneath it, must be
correct for any real-valued baseline, not just the ones this particular dataset happens to hit.

Run with:  uv run --with scipy,numpy,tzdata scripts/gen-nbinom-fixture.py
"""

from __future__ import annotations

import json
from pathlib import Path

from scipy.stats import nbinom

FIXTURE_PATH = Path(__file__).resolve().parent / "nbinom-fixture.json"

# A spread of trimmed-mean baselines: the floor itself, values the seed actually produces
# (0.3, 1.4, 3.4, 11.1, 43.9 — account/location baselines measured in measure-anchor.py runs),
# and deliberately fractional values with more than one decimal digit, which D8's own formula
# (mean of 10 integers) can never produce but the gate must still handle correctly.
M_VALUES = [0.1, 0.3, 1.4, 2.35, 3.4, 7.77, 11.1, 20.6, 43.9, 100.33]

# w=1 is the account verdict (D10); w=4 is the location window (D3).
W_VALUES = [1, 4]

# k spans the account verdict (k=1) and realistic location counts (D4), including the largest
# in the seed (account 6, 15 locations).
K_VALUES = [1, 4, 9, 15]


def build_cases() -> list[dict]:
    cases: list[dict] = []
    for m in M_VALUES:
        r = 10 * m
        for w in W_VALUES:
            p = 10 / (10 + w)
            mean = w * m
            dist = nbinom(r, p)
            # A spread of x around the mean: zero, well below, at, and well above it —
            # duplicates removed, so a small mean doesn't repeat the same x twice.
            xs = sorted({0, round(mean * 0.5), round(mean), round(mean * 1.5), round(mean * 3) + 1})
            for k in K_VALUES:
                alpha = 0.05 / (2 * k)
                for x in xs:
                    cases.append(
                        {
                            "m": m,
                            "w": w,
                            "k": k,
                            "r": r,
                            "p": p,
                            "x": x,
                            "alpha": alpha,
                            "cdf": dist.cdf(x),
                        }
                    )
    return cases


def main() -> int:
    cases = build_cases()
    non_integer_r = [c for c in cases if c["r"] != int(c["r"])]
    print(f"generated {len(cases)} cases, {len(non_integer_r)} with non-integer r")
    assert non_integer_r, "the fixture must include at least one non-integer r case"

    FIXTURE_PATH.write_text(json.dumps(cases, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {FIXTURE_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
