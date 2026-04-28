from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

def test_healthz():
    r = client.get("/healthz")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}

def test_score_endpoint_happy_path():
    r = client.post(
        "/score",
        json={
            "asker": {
                "id": "a", "name": "Asker",
                "skills": ["python", "langchain"],
                "lookingFor": "Senior AI Engineer",
            },
            "candidate": {
                "id": "c", "name": "Sarah",
                "headline": "Senior AI Engineer",
                "role": "AI_ENGINEER",
                "skills": ["python", "langchain", "pytorch"],
            },
            "intent": "Find me a senior AI engineer",
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert 0 <= body["score"] <= 100
    assert body["rationale"]
    assert isinstance(body["shared_ground"], list)

def test_score_endpoint_validation_error():

    r = client.post("/score", json={"intent": "no candidate"})
    assert r.status_code == 422
