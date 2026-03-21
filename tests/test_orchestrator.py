from pathlib import Path

from app.agent.orchestrator import Orchestrator
from app.db.repo import Repository
from app.llm.client import LlmClient
from app.tools.mock_paytm import MockPaytmTools


def build_orchestrator(tmp_path: Path) -> Orchestrator:
    repo = Repository(str(tmp_path / "orch.sqlite3"))
    repo.seed_demo_data()
    tools = MockPaytmTools(repo)
    llm = LlmClient("", "", "llama-3.1-8b-instant")
    return Orchestrator(repo, tools, llm)


def test_order_query_returns_summary(tmp_path: Path) -> None:
    orchestrator = build_orchestrator(tmp_path)
    response = orchestrator.handle_user_text("123", "show recent orders")
    assert "orders" in response
    assert "<b>" in response


def test_refund_requires_confirm_then_executes(tmp_path: Path) -> None:
    orchestrator = build_orchestrator(tmp_path)
    preview = orchestrator.handle_user_text("123", "refund txn-2001 amount 20")
    assert "confirm" in preview.lower()

    confirmed = orchestrator.handle_user_text("123", "confirm")
    assert "Refund initiated" in confirmed
