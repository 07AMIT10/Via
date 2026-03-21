import re
from typing import Any

from app.db.repo import Repository
from app.llm.client import LlmClient
from app.tools.mock_paytm import MockPaytmTools


class Orchestrator:
    def __init__(self, repo: Repository, tools: MockPaytmTools, llm: LlmClient) -> None:
        self.repo = repo
        self.tools = tools
        self.llm = llm

    def handle_user_text(self, telegram_id: str, text: str, input_type: str = "text") -> str:
        user_id = self.repo.ensure_user(telegram_id)
        cleaned = (text or "").strip()
        lowered = cleaned.lower()

        if lowered.startswith("confirm"):
            response = self._handle_confirmation(telegram_id)
            self.repo.save_message(user_id, input_type, cleaned, response)
            return response

        if "settlement" in lowered:
            summary = self.tools.get_settlement_summary()
            s = summary["summary"]
            response = (
                f"📊 <b>Settlement</b>\n"
                f"Gross: <b>₹{s['gross']:,.0f}</b> | Fee: ₹{s['fee']:,.0f} | Net: <b>₹{s['net']:,.0f}</b>"
            )
            self.repo.save_message(user_id, input_type, cleaned, response)
            return response

        if "order" in lowered:
            data = self.tools.fetch_order_list()
            top = ", ".join(f"<code>{o['order_id']}</code> {o['status']}" for o in data["orders"][:3])
            response = f"📋 <b>{data['count']} orders</b>\n{top}"
            self.repo.save_message(user_id, input_type, cleaned, response)
            return response

        if "link" in lowered and any(ch.isdigit() for ch in lowered):
            amount = self._extract_first_amount(cleaned) or 100.0
            link = self.tools.create_link(amount=amount)
            response = f"✅ Payment link <code>{link['link_id']}</code> created for <b>₹{link['amount']:,.0f}</b>"
            self.repo.save_message(user_id, input_type, cleaned, response)
            return response

        if "refund" in lowered:
            txn_id = self._extract_token(cleaned, r"(TXN[-_ ]?\d+)")
            amount = self._extract_first_amount(cleaned) or 100.0
            if not txn_id:
                response = "⚠️ Need a transaction ID to refund — e.g. <code>TXN-2001</code>"
                self.repo.save_message(user_id, input_type, cleaned, response)
                return response
            self.repo.upsert_pending_action(
                telegram_id,
                action_type="initiate_refund",
                payload={"txn_id": txn_id.replace(" ", "-").replace("_", "-"), "amount": amount},
            )
            response = f"💸 Refund <code>{txn_id}</code> for <b>₹{amount:,.0f}</b>\n\nReply <b>confirm</b> to proceed."
            self.repo.save_message(user_id, input_type, cleaned, response)
            return response

        context = self.repo.get_recent_context(user_id)
        llm_text = self.llm.generate(cleaned, history=context)
        self.repo.save_message(user_id, input_type, cleaned, llm_text)
        return llm_text

    def _handle_confirmation(self, telegram_id: str) -> str:
        pending = self.repo.pop_pending_action(telegram_id)
        if not pending:
            return "Nothing pending to confirm."
        if pending["action_type"] == "initiate_refund":
            payload = pending["payload"]
            result = self.tools.initiate_refund(payload["txn_id"], float(payload["amount"]))
            return f"✅ Refund initiated\n<code>{result['refund_id']}</code> — {result['status']}"
        return "Pending action type not supported."

    @staticmethod
    def _extract_first_amount(text: str) -> float | None:
        match = re.search(r"(\d+(?:\.\d{1,2})?)", text)
        if not match:
            return None
        return float(match.group(1))

    @staticmethod
    def _extract_token(text: str, pattern: str) -> str | None:
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            return None
        return str(match.group(1)).upper()
