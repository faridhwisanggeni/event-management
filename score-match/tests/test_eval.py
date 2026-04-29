"""Eval harness — replay 10 hand-labelled fixtures through `POST /score`
and assert the ground-truth candidate ranks #1 among each fixture's
candidate set.

Why this exists
---------------
The spec calls eval harnesses out as the kind of artefact that *separates
senior AI engineers from LLM-prompt jockeys*: a small, repeatable test
that catches scoring regressions before they ship. This harness does
exactly that for the rule-based scorer in `score-match`. When/if the
scorer is swapped for a cross-encoder or an LLM-as-judge, the same
fixtures and assertions stay valid — just point them at the new
implementation.

What it measures
----------------
- **recall@1** — fraction of fixtures where the ground-truth candidate
  ends up rank 1 after scoring all candidates. The strict assertion
  (one test per fixture) requires recall@1 = 100%.
- **recall@3** — softer signal printed in the summary test, useful when
  swapping scorers because a new model may legitimately tie ground truth
  with a near-equivalent candidate.

Running
-------
    cd score-match && pytest tests/test_eval.py -v
    cd score-match && pytest tests/test_eval.py::test_eval_summary -v -s

The harness has no network and no DB dependency — it instantiates the
FastAPI app in-process via `TestClient`. So it runs in CI alongside the
other unit tests.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, List, Tuple

import pytest
from fastapi.testclient import TestClient

from app.main import app

FIXTURES_PATH = Path(__file__).parent.parent / "eval" / "fixtures.json"
FIXTURES: List[Dict[str, Any]] = json.loads(FIXTURES_PATH.read_text())

assert len(FIXTURES) >= 10, f"expected ≥10 fixtures, found {len(FIXTURES)}"


def _strip_ground_truth(cand: Dict[str, Any]) -> Dict[str, Any]:
    """Remove the `ground_truth` flag before sending to the API — it is
    fixture metadata, not part of the AttendeeProfile contract."""
    return {k: v for k, v in cand.items() if k != "ground_truth"}


def _score_all(fx: Dict[str, Any]) -> List[Tuple[str, int, bool]]:
    """Score every candidate in a fixture. Returns list of
    (candidate_id, score, is_ground_truth) sorted by score descending."""
    client = TestClient(app)
    out: List[Tuple[str, int, bool]] = []
    for cand in fx["candidates"]:
        is_gt = bool(cand.get("ground_truth", False))
        resp = client.post(
            "/score",
            json={
                "asker": fx.get("asker"),
                "candidate": _strip_ground_truth(cand),
                "intent": fx["intent"],
            },
        )
        assert resp.status_code == 200, f"{fx['scenario']} {cand['id']}: {resp.text}"
        out.append((cand["id"], resp.json()["score"], is_gt))
    out.sort(key=lambda t: t[1], reverse=True)
    return out


@pytest.mark.parametrize("fx", FIXTURES, ids=[f["scenario"] for f in FIXTURES])
def test_ground_truth_ranks_first(fx: Dict[str, Any]) -> None:
    """Strict: GT candidate must be rank 1 across the candidate set."""
    ranked = _score_all(fx)
    top_id, top_score, top_is_gt = ranked[0]
    gt_id = next(c["id"] for c in fx["candidates"] if c.get("ground_truth"))
    assert top_is_gt, (
        f"{fx['scenario']}: expected GT '{gt_id}' on top, "
        f"got '{top_id}' (score={top_score}). Full ranking: {ranked}"
    )


def test_eval_summary(capsys: pytest.CaptureFixture[str]) -> None:
    """Aggregate recall@1 and recall@3 across all fixtures.

    Strict assertion: recall@1 ≥ 0.9 (gives 1 fixture of slack for
    future scorer swaps that may legitimately tie). Print the full table
    for visibility under `pytest -v -s`.
    """
    rows: List[Tuple[str, int, int, int]] = []  # scenario, gt_rank, gt_score, top_score
    hits_at_1 = 0
    hits_at_3 = 0

    for fx in FIXTURES:
        ranked = _score_all(fx)
        gt_rank = next(i for i, (_, _, is_gt) in enumerate(ranked, 1) if is_gt)
        gt_score = next(s for _, s, is_gt in ranked if is_gt)
        top_score = ranked[0][1]
        rows.append((fx["scenario"], gt_rank, gt_score, top_score))
        if gt_rank == 1:
            hits_at_1 += 1
        if gt_rank <= 3:
            hits_at_3 += 1

    n = len(FIXTURES)
    recall_at_1 = hits_at_1 / n
    recall_at_3 = hits_at_3 / n

    # Pretty print so `pytest -s` shows the table.
    with capsys.disabled():
        print()
        print("=" * 76)
        print(f"score-match eval — {n} fixtures")
        print("=" * 76)
        print(f"{'scenario':<40} {'gt_rank':>8} {'gt_score':>9} {'top_score':>10}")
        print("-" * 76)
        for scenario, gt_rank, gt_score, top_score in rows:
            print(f"{scenario:<40} {gt_rank:>8} {gt_score:>9} {top_score:>10}")
        print("-" * 76)
        print(f"recall@1 = {recall_at_1:.0%}    recall@3 = {recall_at_3:.0%}")
        print("=" * 76)

    assert recall_at_1 >= 0.9, f"recall@1 dropped to {recall_at_1:.0%} — investigate scorer regression"
    assert recall_at_3 == 1.0, f"recall@3 should be 100% on these fixtures, got {recall_at_3:.0%}"
