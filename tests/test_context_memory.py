"""Tests for the new conversational-memory / rolling-context feature."""
from pathlib import Path
from unittest.mock import patch, MagicMock

from app.agent.orchestrator import Orchestrator
from app.db.repo import Repository
from app.llm.client import LlmClient
from app.tools.mock_paytm import MockPaytmTools


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_repo(tmp_path: Path) -> Repository:
    repo = Repository(str(tmp_path / "ctx.sqlite3"))
    repo.seed_demo_data()
    return repo


def _make_orchestrator(tmp_path: Path) -> tuple[Orchestrator, Repository, LlmClient]:
    repo = _make_repo(tmp_path)
    tools = MockPaytmTools(repo)
    llm = LlmClient("", "", "test-model")
    orch = Orchestrator(repo, tools, llm)
    return orch, repo, llm


# ---------------------------------------------------------------------------
# repo.get_recent_context
# ---------------------------------------------------------------------------

def test_get_recent_context_returns_history(tmp_path: Path) -> None:
    repo = _make_repo(tmp_path)
    uid = repo.ensure_user("u1")

    repo.save_message(uid, "text", "hello", "hi there")
    repo.save_message(uid, "text", "show orders", "found 4 orders")
    repo.save_message(uid, "voice", "refund status", "no pending refunds")

    ctx = repo.get_recent_context(uid)
    # 3 exchanges -> 6 messages (user + assistant each)
    assert len(ctx) == 6
    assert ctx[0] == {"role": "user", "content": "hello"}
    assert ctx[1] == {"role": "assistant", "content": "hi there"}
    assert ctx[-2] == {"role": "user", "content": "refund status"}
    assert ctx[-1] == {"role": "assistant", "content": "no pending refunds"}


def test_get_recent_context_empty_for_new_user(tmp_path: Path) -> None:
    repo = _make_repo(tmp_path)
    uid = repo.ensure_user("brand-new-user")
    ctx = repo.get_recent_context(uid)
    assert ctx == []


def test_get_recent_context_respects_limit(tmp_path: Path) -> None:
    repo = _make_repo(tmp_path)
    uid = repo.ensure_user("u2")

    for i in range(10):
        repo.save_message(uid, "text", f"msg-{i}", f"reply-{i}")

    ctx = repo.get_recent_context(uid, limit=3)
    # limit=3 means 3 DB rows -> 6 role messages, but only the most recent 3 exchanges
    assert len(ctx) == 6
    assert ctx[0]["content"] == "msg-7"  # oldest of the 3 kept
    assert ctx[-1]["content"] == "reply-9"  # newest


# ---------------------------------------------------------------------------
# LlmClient.generate – payload structure
# ---------------------------------------------------------------------------

def test_generate_builds_payload_with_history(tmp_path: Path) -> None:
    llm = LlmClient("https://example.com/v1/chat/completions", "key", "model")
    history = [
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": "hello"},
    ]

    with patch("app.llm.client.requests.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "test reply"}}]
        }
        mock_resp.raise_for_status = MagicMock()
        mock_post.return_value = mock_resp

        result = llm.generate("what now?", history=history)

    assert result == "test reply"
    called_payload = mock_post.call_args.kwargs.get("json") or mock_post.call_args[1].get("json")
    msgs = called_payload["messages"]
    # system + 2 history + current user = 4
    assert len(msgs) == 4
    assert msgs[0]["role"] == "system"
    assert msgs[1] == {"role": "user", "content": "hi"}
    assert msgs[2] == {"role": "assistant", "content": "hello"}
    assert msgs[3] == {"role": "user", "content": "what now?"}


def test_generate_works_without_history() -> None:
    """Backward compat: calling generate without history still works."""
    llm = LlmClient("https://example.com/v1/chat/completions", "key", "model")

    with patch("app.llm.client.requests.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "choices": [{"message": {"content": "ok"}}]
        }
        mock_resp.raise_for_status = MagicMock()
        mock_post.return_value = mock_resp

        result = llm.generate("just a prompt")

    assert result == "ok"
    called_payload = mock_post.call_args.kwargs.get("json") or mock_post.call_args[1].get("json")
    msgs = called_payload["messages"]
    # system + user = 2  (no history)
    assert len(msgs) == 2


# ---------------------------------------------------------------------------
# Orchestrator integration – context flows through
# ---------------------------------------------------------------------------

def test_orchestrator_passes_context_to_llm(tmp_path: Path) -> None:
    """When the orchestrator falls through to the LLM path, it should
    include prior context in the generate() call."""
    orch, repo, llm = _make_orchestrator(tmp_path)
    uid = repo.ensure_user("t-100")

    # Seed a prior message so there's context to retrieve
    repo.save_message(uid, "text", "show orders", "found 4 orders")

    with patch.object(llm, "generate", return_value="mocked reply") as mock_gen:
        reply = orch.handle_user_text("t-100", "tell me more about the first one")

    assert reply == "mocked reply"
    # Verify generate was called with history kwarg containing prior context
    args, kwargs = mock_gen.call_args
    assert "history" in kwargs
    assert len(kwargs["history"]) == 2  # 1 prior exchange = 2 messages
    assert kwargs["history"][0]["content"] == "show orders"
    assert kwargs["history"][1]["content"] == "found 4 orders"
