"""Deterministic match-scoring algorithm.

Why deterministic instead of LLM-backed?
----------------------------------------
- **Cost & latency**: an event with 50 candidates would mean 50 LLM calls
  per concierge turn. This service runs each scoring in <5 ms.
- **Predictability**: same input → same output, which makes the agent's
  behaviour easier to debug and test.
- **Swappable**: the contract (request/response schema) stays the same if
  someone later replaces this with a cross-encoder model or a vector reranker.
  The NestJS agent doesn't change.

The algorithm is intentionally simple but transparent. Each component
contributes a bounded number of points; the final score is clamped 0..100.

Components (max points):
    role_complement          30   — candidate fills a role the asker is looking for
    skill_overlap            25   — Jaccard overlap of skill tags
    intent_term_overlap      30   — intent tokens present in candidate profile text
    open_to_chat_baseline    15   — small base because we never recommend closed profiles

These weights are constants; tweak ``WEIGHTS`` to retune. No global state.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable, List, Optional, Set, Tuple

from .schemas import AttendeeProfile, ScoreResponse

# --- Tunables ---------------------------------------------------------------
WEIGHTS = {
    "role_complement": 30,
    "skill_overlap": 25,
    "intent_term_overlap": 30,
    "open_to_chat_baseline": 15,
}

# Stop tokens we strip when measuring intent overlap. Keeping the list short
# avoids over-aggressive filtering — embeddings handle nuance upstream; this
# is just a lexical bonus.
_STOPWORDS: Set[str] = {
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "from",
    "has", "have", "i", "in", "is", "it", "its", "looking", "me", "my",
    "of", "on", "or", "that", "the", "this", "to", "want", "who", "with",
    "you", "your", "find", "someone", "anyone", "would", "like",
}

_TOKEN_RE = re.compile(r"[a-z0-9+]+")


def _tokens(text: Optional[str]) -> Set[str]:
    if not text:
        return set()
    return {t for t in _TOKEN_RE.findall(text.lower()) if t and t not in _STOPWORDS}


def _profile_text(p: AttendeeProfile) -> str:
    """Concatenate searchable profile fields for lexical matching."""
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


def _role_complement(asker: Optional[AttendeeProfile], candidate: AttendeeProfile,
                     intent_tokens: Set[str]) -> Tuple[float, Optional[str]]:
    """Award points if the candidate appears to fill a role the asker wants.

    Two signals (either is enough — we take the max):
    - Asker's `lookingFor` text mentions a token that overlaps the candidate's
      role/headline.
    - The intent itself does the same.
    """
    cand_role_tokens = _tokens(candidate.role) | _tokens(candidate.roleCode) | _tokens(candidate.headline)
    if not cand_role_tokens:
        return 0.0, None

    looking_for_tokens = _tokens(asker.lookingFor) if asker else set()
    overlap_lf = cand_role_tokens & looking_for_tokens
    overlap_intent = cand_role_tokens & intent_tokens

    overlap = overlap_lf | overlap_intent
    if not overlap:
        return 0.0, None

    # Up to full weight when there is a strong (>=2 tokens) match, half-weight
    # for a single-token match. Avoids letting a stop-word slip-through dominate.
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
    # Award proportionally to coverage of the intent, capped at full weight.
    coverage = min(1.0, len(matched) / max(1, len(intent_tokens)))
    pts = coverage * WEIGHTS["intent_term_overlap"]
    return pts, matched


@dataclass
class _Component:
    name: str
    points: float
    detail: str


def score_match(asker: Optional[AttendeeProfile],
                candidate: AttendeeProfile,
                intent: str) -> ScoreResponse:
    """Compute the final score + rationale + shared-ground list.

    Pure function: no I/O, no globals mutated. Easy to unit test.
    """
    intent_tokens = _tokens(intent)
    components: List[_Component] = []
    shared_ground: List[str] = []

    # 1. Role complement
    pts, detail = _role_complement(asker, candidate, intent_tokens)
    if pts > 0 and detail:
        components.append(_Component("role_complement", pts, detail))
        shared_ground.append(detail)

    # 2. Skill overlap
    pts, overlapping = _skill_overlap(asker, candidate)
    if overlapping:
        components.append(
            _Component("skill_overlap", pts, f"shared skills: {', '.join(overlapping)}")
        )
        shared_ground.extend(f"both work with {s}" for s in overlapping)

    # 3. Intent term overlap (lexical bonus on top of the semantic recall the
    #    agent already did via pgvector).
    pts, matched_terms = _intent_term_overlap(intent_tokens, candidate)
    if matched_terms:
        components.append(
            _Component(
                "intent_term_overlap",
                pts,
                f"intent terms present in profile: {', '.join(matched_terms)}",
            )
        )

    # 4. Open-to-chat baseline (small, only if open).
    if candidate.openToChat:
        components.append(_Component("open_to_chat_baseline",
                                     float(WEIGHTS["open_to_chat_baseline"]),
                                     "candidate is open to chat"))

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
    # Sort by contribution descending and quote the top reasons.
    top = sorted(components, key=lambda c: c.points, reverse=True)[:3]
    parts = "; ".join(f"{c.detail} (+{int(round(c.points))})" for c in top)
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
