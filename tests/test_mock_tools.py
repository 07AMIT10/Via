from pathlib import Path

from app.db.repo import Repository
from app.tools.mock_paytm import MockPaytmTools


def test_create_and_fetch_link(tmp_path: Path) -> None:
    repo = Repository(str(tmp_path / "mock.sqlite3"))
    tools = MockPaytmTools(repo)

    created = tools.create_link(250.0, "Amit")
    fetched = tools.fetch_link(created["link_id"])

    assert fetched["link_id"] == created["link_id"]
    assert fetched["amount"] == 250.0
    assert fetched["customer_name"] == "Amit"


def test_refund_workflow(tmp_path: Path) -> None:
    repo = Repository(str(tmp_path / "refund.sqlite3"))
    tools = MockPaytmTools(repo)

    initiated = tools.initiate_refund("TXN-2001", 99.0)
    status = tools.check_refund_status(initiated["refund_id"])

    assert status["refund_id"] == initiated["refund_id"]
    assert status["txn_id"] == "TXN-2001"
    assert status["status"] == "PENDING"
