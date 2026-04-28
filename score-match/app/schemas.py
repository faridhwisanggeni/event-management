"""Request/response schemas for the score_match microservice.

The shape mirrors what NestJS sends in `score-match.tool.ts`. We accept extra
keys (Prisma may add fields over time) by using `extra="ignore"` so the
service stays forward-compatible without a redeploy in lockstep.
"""

from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AttendeeProfile(BaseModel):
    """Subset of fields we need from a Prisma `Attendee` row.

    NestJS sends the full row; we only declare what we actually use. Extra
    keys are ignored so additive schema changes upstream don't break us.
    """

    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    headline: Optional[str] = None
    bio: Optional[str] = None
    company: Optional[str] = None
    # Prisma stores either a Role relation or a roleId; NestJS sends the raw
    # row, so the role *code* may not be present here. We keep both possible
    # carriers and let the scorer use whichever shows up.
    role: Optional[str] = None
    roleCode: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    lookingFor: Optional[str] = None
    openToChat: bool = True


class ScoreRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    asker: Optional[AttendeeProfile] = None  # may be null if not yet persisted
    candidate: AttendeeProfile
    intent: str


class ScoreResponse(BaseModel):
    score: int  # clamped 0..100
    rationale: str
    shared_ground: List[str]
