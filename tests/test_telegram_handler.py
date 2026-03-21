from pathlib import Path

from app.agent.orchestrator import Orchestrator
from app.db.repo import Repository
from app.llm.client import LlmClient
from app.telegram.handler import TelegramHandler
from app.tools.mock_paytm import MockPaytmTools
from app.voice.stt import SttClient


def build_handler(tmp_path: Path) -> TelegramHandler:
    repo = Repository(str(tmp_path / "telegram.sqlite3"))
    repo.seed_demo_data(force=True)
    orchestrator = Orchestrator(repo, MockPaytmTools(repo), LlmClient("", "", "llama"))
    stt = SttClient("", "", "whisper-large-v3-turbo")
    return TelegramHandler(orchestrator, stt, bot_token="")


def test_voice_update_without_bot_token_falls_back(tmp_path: Path) -> None:
    handler = build_handler(tmp_path)
    result = handler.process_update(
        {"message": {"chat": {"id": 999}, "voice": {"file_id": "abc123"}}}
    )
    assert result["ok"] is True
    assert result["input_type"] == "voice"
    assert "transcription unavailable" in result["transcript"]


def test_audio_update_is_supported(tmp_path: Path) -> None:
    handler = build_handler(tmp_path)
    result = handler.process_update(
        {"message": {"chat": {"id": 999}, "audio": {"file_id": "xyz123"}}}
    )
    assert result["ok"] is True
    assert result["input_type"] == "voice"
    assert "transcription unavailable" in result["transcript"]
