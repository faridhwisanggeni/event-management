# score_match

Stateless scoring microservice used by the **Concierge agent** in
NestJS. Given an *asker*, a *candidate*, and the asker's *intent*, returns a
`0–100` match score plus a human-readable rationale and the explicit list of
shared ground.

## Why a separate service?

The NestJS agent already has a fallback that asks the LLM to score, but:

- **Cost / latency** — an event with 50 candidates would mean 50 LLM calls
  per concierge turn. This service scores each candidate in microseconds.
- **Determinism** — same input → same output, which makes the agent's
  behaviour reproducible and easy to unit test.
- **Swappable** — the contract (`POST /score`) doesn't depend on how scoring
  is implemented. You can later replace the rule-based scorer with a
  cross-encoder, a pgvector-based reranker, or a different LLM prompt without
  touching NestJS or the agent prompt.

## Contract

### `POST /score`

Request:

```json
{
  "asker": {
    "id": "uuid",
    "name": "Asker",
    "skills": ["python", "langchain"],
    "lookingFor": "Senior AI Engineer with LLM experience"
  },
  "candidate": {
    "id": "uuid",
    "name": "Sarah",
    "headline": "Senior AI Engineer",
    "role": "AI_ENGINEER",
    "skills": ["python", "langchain", "pytorch"],
    "openToChat": true
  },
  "intent": "Find me a senior AI engineer with LLM experience"
}
```

Response:

```json
{
  "score": 88,
  "rationale": "Score 88/100 — role match on 'engineer, ai' (+30); shared skills: langchain, python (+17); intent terms present in profile: ai, engineer, senior (+20).",
  "shared_ground": [
    "role match on 'engineer, ai'",
    "both work with langchain",
    "both work with python"
  ]
}
```

`asker` is **optional** (the agent might score without prior context).
Unknown fields are ignored — additive Prisma changes won't break the service.

### `GET /healthz`

Liveness probe used by `docker-compose`.

## Algorithm

Four bounded components are summed and clamped to `[0, 100]`:

| Component | Max | Description |
|---|---|---|
| `role_complement` | 30 | Candidate's role / headline tokens overlap with asker's `lookingFor` or the intent. |
| `skill_overlap` | 25 | Jaccard overlap between asker and candidate skill tags. |
| `intent_term_overlap` | 30 | Intent tokens (after stop-word filter) found anywhere in the candidate profile. |
| `open_to_chat_baseline` | 15 | Small base; absent if the candidate is closed to chat. |

Tweak `WEIGHTS` in `app/scoring.py` to retune. There is **no global state**
and **no external I/O** beyond the FastAPI request — easy to test.

## Running locally

```bash
# from this directory
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q
uvicorn app.main:app --reload --port 8000
```

Then:

```bash
curl -s http://localhost:8000/healthz
curl -s -X POST http://localhost:8000/score \
  -H 'content-type: application/json' \
  -d '{"candidate":{"id":"c","name":"X","skills":["python"]},"intent":"python developer"}' | jq
```

## Running via docker-compose (with NestJS)

The repo's top-level `docker-compose.yml` already wires this service in and
sets `SCORE_MATCH_URL=http://score-match:8000` on the NestJS `api` container.
NestJS will call FastAPI when the env var is set; otherwise it falls back to
its in-process LLM scorer.

```bash
docker compose up -d --build
```

## Tests

```bash
pytest -q
```

- `tests/test_scoring.py` — unit tests on the pure algorithm.
- `tests/test_api.py` — HTTP-level happy-path + validation via Starlette TestClient.
