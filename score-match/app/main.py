"""FastAPI application exposing a single deterministic scoring endpoint.

The service is intentionally tiny — one route, one pure function. This makes
it easy to swap the scorer (e.g. for a cross-encoder) without touching either
the API contract or the NestJS agent.
"""

from __future__ import annotations

import logging
import os

from fastapi import FastAPI

from .schemas import ScoreRequest, ScoreResponse
from .scoring import score_match

# Structured-ish logging; matches the lightweight conventions of the NestJS
# side so log aggregation is uniform.
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("score_match")

app = FastAPI(
    title="score_match",
    version="1.0.0",
    description=(
        "Stateless scoring microservice for the MyConnect concierge agent. "
        "Given an asker, a candidate, and the asker's intent, returns a 0–100 "
        "match score with a human-readable rationale and shared-ground list."
    ),
)


@app.get("/healthz")
def healthz() -> dict:
    """Liveness probe used by docker-compose `depends_on: condition`."""
    return {"status": "ok"}


@app.post("/score", response_model=ScoreResponse)
def score(req: ScoreRequest) -> ScoreResponse:
    result = score_match(req.asker, req.candidate, req.intent)
    log.info(
        "scored candidate=%s score=%d intent_chars=%d",
        req.candidate.id,
        result.score,
        len(req.intent or ""),
    )
    return result
