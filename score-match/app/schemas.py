from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

class AttendeeProfile(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    name: str
    headline: Optional[str] = None
    bio: Optional[str] = None
    company: Optional[str] = None



    role: Optional[str] = None
    roleCode: Optional[str] = None
    skills: List[str] = Field(default_factory=list)
    lookingFor: Optional[str] = None
    openToChat: bool = True

class ScoreRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    asker: Optional[AttendeeProfile] = None
    candidate: AttendeeProfile
    intent: str

class ScoreResponse(BaseModel):
    score: int
    rationale: str
    shared_ground: List[str]
