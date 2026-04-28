from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, List, Optional, Set, Tuple

from .schemas import AttendeeProfile, ScoreResponse

WEIGHTS = {
    "role_complement": 25,
    "skill_overlap": 25,
    "intent_term_overlap": 35,
    "open_to_chat_baseline": 10,
    "seniority_conflict": 20,
}

_STOPWORDS: Set[str] = {
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
    "has", "have", "i", "in", "is", "it", "its", "looking", "me", "my",
    "of", "on", "or", "that", "the", "this", "to", "want", "who", "with",
    "you", "your", "find", "someone", "anyone", "would", "like",
    "more", "than", "one", "two", "three", "year", "years", "experience",
    "score", "up", "down", "over", "under", "least", "any",
}

_SENIORITY_GROUPS: dict[str, Set[str]] = {
    "junior": {"junior", "jr", "entry", "intern", "fresher", "fresh", "beginner", "trainee"},
    "mid": {"mid", "intermediate", "midlevel"},
    "senior": {
        "senior", "sr", "lead", "principal", "staff", "head", "chief",
        "director", "vp", "cto", "executive",
    },
}

_TOKEN_RE = re.compile(r"[a-z0-9+]+")

def _tokens(text: Optional[str]) -> Set[str]:
    if not text:
        return set()
    return {t for t in _TOKEN_RE.findall(text.lower()) if t and t not in _STOPWORDS}

def _profile_text(p: AttendeeProfile) -> str:
    parts: List[str] = [
        p.name,
        p.headline or "",
        p.company or "",
        p.role or p.roleCode or "",
        " ".join(p.skills or []),
        p.bio or "",
        p.lookingFor or "",
    ]
    return " ".join(parts)

def _candidate_text_tokens(candidate: AttendeeProfile) -> Set[str]:
    return (
        _tokens(candidate.role)
        | _tokens(candidate.roleCode)
        | _tokens(candidate.headline)
        | _tokens(candidate.bio)
        | _tokens(candidate.lookingFor)
    )

def _role_complement(candidate: AttendeeProfile,
                     intent_tokens: Set[str]) -> Tuple[float, Optional[str]]:
    cand_tokens = _candidate_text_tokens(candidate)
    if not cand_tokens or not intent_tokens:
        return 0.0, None

    overlap = cand_tokens & intent_tokens
    if not overlap:
        return 0.0, None

    pts = WEIGHTS["role_complement"] if len(overlap) >= 2 else WEIGHTS["role_complement"] * 0.6
    label = ", ".join(sorted(overlap))
    return pts, f"role match on '{label}'"

def _skill_overlap(asker: Optional[AttendeeProfile],
                   candidate: AttendeeProfile) -> Tuple[float, List[str]]:
    if not asker or not asker.skills or not candidate.skills:
        return 0.0, []
    a = {s.lower().strip() for s in asker.skills if s.strip()}
    c = {s.lower().strip() for s in candidate.skills if s.strip()}
    inter = a & c
    union = a | c
    if not union:
        return 0.0, []
    jaccard = len(inter) / len(union)
    pts = jaccard * WEIGHTS["skill_overlap"]
    return pts, sorted(inter)

def _intent_term_overlap(intent_tokens: Set[str],
                         candidate: AttendeeProfile) -> Tuple[float, List[str]]:
    if not intent_tokens:
        return 0.0, []
    cand_tokens = _tokens(_profile_text(candidate))
    matched = sorted(intent_tokens & cand_tokens)
    if not matched:
        return 0.0, []

    coverage = min(1.0, len(matched) / max(1, len(intent_tokens)))
    pts = coverage * WEIGHTS["intent_term_overlap"]
    return pts, matched

def _seniority_conflict(candidate: AttendeeProfile,
                        intent_tokens: Set[str]) -> Tuple[float, Optional[str]]:
    intent_levels = {g for g, terms in _SENIORITY_GROUPS.items() if terms & intent_tokens}
    if not intent_levels:
        return 0.0, None

    cand_tokens = _candidate_text_tokens(candidate)
    cand_levels = {g for g, terms in _SENIORITY_GROUPS.items() if terms & cand_tokens}
    if not cand_levels:
        return 0.0, None

    if intent_levels & cand_levels:
        return 0.0, None

    intent_label = "/".join(sorted(intent_levels))
    cand_label = "/".join(sorted(cand_levels))
    return (
        -float(WEIGHTS["seniority_conflict"]),
        f"seniority mismatch: looking for {intent_label} but profile reads {cand_label}",
    )

@dataclass
class _Component:
    name: str
    points: float
    detail: str

def score_match(asker: Optional[AttendeeProfile],
                candidate: AttendeeProfile,
                intent: str) -> ScoreResponse:
    intent_tokens = _tokens(intent)
    components: List[_Component] = []
    shared_ground: List[str] = []

    pts, detail = _role_complement(candidate, intent_tokens)
    if pts > 0 and detail:
        components.append(_Component("role_complement", pts, detail))
        shared_ground.append(detail)

    pts, overlapping = _skill_overlap(asker, candidate)
    if overlapping:
        components.append(
            _Component("skill_overlap", pts, f"shared skills: {', '.join(overlapping)}")
        )
        shared_ground.extend(f"both work with {s}" for s in overlapping)

    pts, matched_terms = _intent_term_overlap(intent_tokens, candidate)
    if matched_terms:
        components.append(
            _Component(
                "intent_term_overlap",
                pts,
                f"intent terms present in profile: {', '.join(matched_terms)}",
            )
        )

    has_positive_signal = any(c.points > 0 for c in components)
    if candidate.openToChat and has_positive_signal:
        components.append(_Component("open_to_chat_baseline",
                                     float(WEIGHTS["open_to_chat_baseline"]),
                                     "candidate is open to chat"))

    pts, detail = _seniority_conflict(candidate, intent_tokens)
    if pts < 0 and detail:
        components.append(_Component("seniority_conflict", pts, detail))

    raw_total = sum(c.points for c in components)
    score = int(round(max(0.0, min(100.0, raw_total))))

    rationale = _build_rationale(components, score, candidate)

    return ScoreResponse(
        score=score,
        rationale=rationale,
        shared_ground=_dedupe(shared_ground),
    )

def _build_rationale(components: List[_Component], score: int,
                     candidate: AttendeeProfile) -> str:
    if not components:
        return (
            f"No strong signal between the intent and {candidate.name}'s "
            "profile. Score reflects an absence of overlap rather than a negative."
        )

    ranked = sorted(components, key=lambda c: abs(c.points), reverse=True)[:3]
    parts = "; ".join(
        f"{c.detail} ({'+' if c.points >= 0 else '-'}{int(round(abs(c.points)))})"
        for c in ranked
    )
    return f"Score {score}/100 — {parts}."

def _dedupe(items: Iterable[str]) -> List[str]:
    seen: Set[str] = set()
    out: List[str] = []
    for x in items:
        key = x.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(x)
    return out
