from __future__ import annotations

from app.schemas import AttendeeProfile
from app.scoring import score_match, WEIGHTS

def _profile(**overrides) -> AttendeeProfile:
    base = {
        "id": "u-1",
        "name": "Test User",
        "headline": None,
        "bio": None,
        "company": None,
        "role": None,
        "skills": [],
        "lookingFor": None,
        "openToChat": True,
    }
    base.update(overrides)
    return AttendeeProfile(**base)

def test_strong_match_scores_high():
    asker = _profile(
        id="a", name="Asker",
        skills=["python", "langchain"],
        lookingFor="Senior AI Engineer with LLM experience",
    )
    candidate = _profile(
        id="c", name="Sarah",
        headline="Senior AI Engineer",
        role="AI_ENGINEER",
        skills=["python", "langchain", "pytorch"],
        bio="Built RAG pipelines for fintech",
    )
    res = score_match(asker, candidate, "Find me a senior AI engineer with LLM experience")


    assert res.score >= 70, res.rationale

    joined = " ".join(res.shared_ground).lower()
    assert "python" in joined and "langchain" in joined

    assert str(res.score) in res.rationale

def test_weak_match_scores_low_but_nonzero_when_open():
    asker = _profile(id="a", name="Asker", skills=["go"], lookingFor="rust developer")
    candidate = _profile(
        id="c", name="Bob",
        headline="UX Designer",
        role="DESIGNER",
        skills=["figma"],
    )
    res = score_match(asker, candidate, "Looking for a rust systems engineer")


    assert res.score <= WEIGHTS["open_to_chat_baseline"] + 5
    assert res.shared_ground == []

def test_closed_to_chat_loses_baseline():
    cand_open = _profile(id="c1", name="A", openToChat=True)
    cand_closed = _profile(id="c2", name="B", openToChat=False)
    intent = "any"

    s_open = score_match(None, cand_open, intent).score
    s_closed = score_match(None, cand_closed, intent).score
    assert s_open > s_closed

def test_no_asker_still_scores_via_intent():

    candidate = _profile(
        id="c", name="Sarah",
        headline="Senior AI Engineer",
        role="AI_ENGINEER",
        skills=["python", "langchain"],
    )
    res = score_match(None, candidate, "ai engineer python langchain")

    assert res.score >= 50, res.rationale

def test_score_is_clamped_and_rationale_nonempty_when_no_signal():
    candidate = _profile(id="c", name="Ghost", openToChat=False)
    res = score_match(None, candidate, "")
    assert res.score == 0
    assert res.rationale

def test_extra_keys_in_payload_are_ignored():

    candidate = AttendeeProfile.model_validate(
        {
            "id": "c", "name": "X",
            "skills": ["python"],
            "futureField": "ignored",
            "createdAt": "2025-01-01T00:00:00Z",
        }
    )
    assert candidate.skills == ["python"]
