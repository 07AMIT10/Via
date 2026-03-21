from fastapi.testclient import TestClient

from app.main import app


def test_health() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_webhook_text_message() -> None:
    client = TestClient(app)
    payload = {
        "message": {"chat": {"id": 101}, "text": "show settlement summary"},
    }
    response = client.post(
        "/telegram/webhook",
        json=payload,
        headers={"X-Telegram-Bot-Api-Secret-Token": "local-secret"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["ok"] is True
    assert data["input_type"] == "text"
