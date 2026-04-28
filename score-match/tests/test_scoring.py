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

def test_weak_match_with_no_signal_scores_zero():
    asker = _profile(id="a", name="Asker", skills=["go"], lookingFor="rust developer")
    candidate = _profile(
        id="c", name="Bob",
        headline="UX Designer",
        role="DESIGNER",
        skills=["figma"],
    )
    res = score_match(asker, candidate, "Looking for a rust systems engineer")

    assert res.score == 0
    assert res.shared_ground == []

def test_closed_to_chat_loses_baseline_when_other_signal_exists():
    cand_open = _profile(id="c1", name="A", role="BACKEND_DEVELOPER", openToChat=True)
    cand_closed = _profile(id="c2", name="B", role="BACKEND_DEVELOPER", openToChat=False)
    intent = "backend developer"

    s_open = score_match(None, cand_open, intent).score
    s_closed = score_match(None, cand_closed, intent).score
    assert s_open > s_closed
    assert s_open - s_closed == WEIGHTS["open_to_chat_baseline"]

def test_open_to_chat_baseline_not_added_without_other_signal():
    candidate = _profile(
        id="c", name="Ghost",
        headline="UX Designer", role="DESIGNER",
        openToChat=True,
    )
    res = score_match(None, candidate, "rust systems engineer")

    assert res.score == 0

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

def test_seniority_conflict_penalises_senior_candidate_for_junior_intent():
    candidate = _profile(
        id="c", name="Hari",
        headline="Senior Software Engineer",
        role="BACKEND_DEVELOPER",
        skills=["java", "springboot"],
        bio="10 years building distributed systems",
        lookingFor="interesting product challenges",
    )
    res = score_match(None, candidate, "junior java developer with 1 year experience")

    assert "seniority mismatch" in res.rationale.lower()
    assert res.score < 50

def test_ambiguous_seniority_no_penalty_when_both_levels_present():
    candidate = _profile(
        id="c", name="Ferdinand",
        headline="Senior Software Engineer",
        role="BACKEND_DEVELOPER",
        skills=["java", "springboot"],
        bio="Junior backend developer with 2 years of professional experience",
        lookingFor="senior java developer role",
    )
    res = score_match(None, candidate, "junior java developer with experience")

    assert "seniority mismatch" not in res.rationale.lower()
    assert res.score >= 50, res.rationale

def test_role_complement_uses_bio_not_just_role_field():
    candidate = _profile(
        id="c", name="Ferdinand",
        headline="Software Engineer",
        role="BACKEND_DEVELOPER",
        skills=["java"],
        bio="Junior developer eager to learn",
    )
    res = score_match(None, candidate, "looking for junior developer")

    assert "junior" in res.rationale.lower()
    assert res.score >= 40, res.rationale

def test_asker_lookingfor_does_not_leak_into_role_match():
    asker = _profile(id="a", name="Asker", lookingFor="senior backend developer")
    candidate = _profile(
        id="c", name="Carol",
        headline="Frontend Designer",
        role="FRONTEND_DEVELOPER",
        skills=["figma"],
    )
    res = score_match(asker, candidate, "product manager")

    assert "backend" not in res.rationale.lower()
    assert "developer" not in res.rationale.lower() or res.score < 40

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
