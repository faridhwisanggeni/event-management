from __future__ import annotations

import logging
import os

from fastapi import FastAPI

from .schemas import ScoreRequest, ScoreResponse
from .scoring import score_match

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
log = logging.getLogger("score_match")

app = FastAPI(
    title="score_match",
    version="1.0.0",
    description=(
        "Stateless scoring microservice for concierge agent. "
        "Given an asker, a candidate, and the asker's intent, returns a 0–100 "
        "match score with a human-readable rationale and shared-ground list."
    ),
)

@app.get("/healthz")
def healthz() -> dict:
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
