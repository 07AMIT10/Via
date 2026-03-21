import time
from typing import Any

from app.db.repo import Repository


class MockPaytmTools:
    def __init__(self, repo: Repository) -> None:
        self.repo = repo

    def create_link(self, amount: float, customer_name: str = "merchant_customer") -> dict[str, Any]:
        link_id = f"LINK-{int(time.time())}"
        result = self.repo.create_payment_link(link_id=link_id, amount=amount, customer_name=customer_name)
        self.repo.log_tool("create_link", {"amount": amount, "customer_name": customer_name}, result)
        return result

    def fetch_link(self, link_id: str) -> dict[str, Any]:
        result = self.repo.get_payment_link(link_id)
        payload = result or {"error": "link_not_found", "link_id": link_id}
        self.repo.log_tool("fetch_link", {"link_id": link_id}, payload)
        return payload

    def fetch_order_list(self, limit: int = 10) -> dict[str, Any]:
        rows = self.repo.list_orders(limit=limit)
        result = {"orders": rows, "count": len(rows)}
        self.repo.log_tool("fetch_order_list", {"limit": limit}, result)
        return result

    def initiate_refund(self, txn_id: str, amount: float) -> dict[str, Any]:
        refund_id = f"RFND-{int(time.time())}"
        result = self.repo.create_refund(refund_id=refund_id, txn_id=txn_id, amount=amount, status="PENDING")
        self.repo.log_tool("initiate_refund", {"txn_id": txn_id, "amount": amount}, result)
        return result

    def check_refund_status(self, refund_id: str) -> dict[str, Any]:
        result = self.repo.get_refund(refund_id)
        payload = result or {"error": "refund_not_found", "refund_id": refund_id}
        self.repo.log_tool("check_refund_status", {"refund_id": refund_id}, payload)
        return payload

    def fetch_refund_list(self, limit: int = 10) -> dict[str, Any]:
        rows = self.repo.list_refunds(limit=limit)
        result = {"refunds": rows, "count": len(rows)}
        self.repo.log_tool("fetch_refund_list", {"limit": limit}, result)
        return result

    def get_settlement_summary(self) -> dict[str, Any]:
        summary = self.repo.get_settlement_summary()
        result = {"summary": summary}
        self.repo.log_tool("get_settlement_summary", {}, result)
        return result

    def get_settlement_detail(self, limit: int = 20) -> dict[str, Any]:
        rows = self.repo.list_settlement_details(limit=limit)
        result = {"settlements": rows, "count": len(rows)}
        self.repo.log_tool("get_settlement_detail", {"limit": limit}, result)
        return result
