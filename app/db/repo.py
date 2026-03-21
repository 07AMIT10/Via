import json
import sqlite3
from contextlib import contextmanager
from typing import Any

from app.db.models import SCHEMA_SQL


class Repository:
    def __init__(self, db_path: str) -> None:
        self.db_path = db_path
        self._initialize()

    @contextmanager
    def _connect(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _initialize(self) -> None:
        with self._connect() as conn:
            conn.executescript(SCHEMA_SQL)
            conn.commit()

    def ensure_user(self, telegram_id: str) -> int:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT id FROM users WHERE telegram_id = ?", (telegram_id,)
            ).fetchone()
            if row:
                return int(row["id"])
            cursor = conn.execute(
                "INSERT INTO users(telegram_id) VALUES(?)",
                (telegram_id,),
            )
            conn.commit()
            return int(cursor.lastrowid)

    def save_message(
        self, user_id: int, input_type: str, transcript_text: str, response_text: str
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO messages(user_id, input_type, transcript_text, response_text)
                VALUES(?, ?, ?, ?)
                """,
                (user_id, input_type, transcript_text, response_text),
            )
            conn.commit()

    def get_last_input_type_for_telegram_user(self, telegram_id: str) -> str | None:
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT m.input_type
                FROM messages m
                JOIN users u ON u.id = m.user_id
                WHERE u.telegram_id = ?
                ORDER BY m.id DESC
                LIMIT 1
                """,
                (telegram_id,),
            ).fetchone()
            return str(row["input_type"]) if row else None

    def get_recent_context(
        self, user_id: int, limit: int = 20, max_age_minutes: int = 5,
    ) -> list[dict[str, str]]:
        """Return recent messages as LLM-ready [{role, content}, ...] list.

        Only includes messages from the last *max_age_minutes* to avoid
        injecting stale context from earlier sessions.
        """
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT transcript_text, response_text
                FROM messages
                WHERE user_id = ?
                  AND created_at >= datetime('now', ?)
                ORDER BY id DESC
                LIMIT ?
                """,
                (user_id, f"-{max_age_minutes} minutes", limit),
            ).fetchall()
        messages: list[dict[str, str]] = []
        for row in reversed(rows):
            messages.append({"role": "user", "content": row["transcript_text"]})
            messages.append({"role": "assistant", "content": row["response_text"]})
        return messages

    def log_tool(self, tool_name: str, args: dict[str, Any], result: dict[str, Any]) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO tool_audit(tool_name, args_json, result_json)
                VALUES(?, ?, ?)
                """,
                (tool_name, json.dumps(args), json.dumps(result)),
            )
            conn.commit()

    def upsert_pending_action(
        self, telegram_id: str, action_type: str, payload: dict[str, Any]
    ) -> None:
        payload_json = json.dumps(payload)
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO pending_actions(telegram_id, action_type, payload_json)
                VALUES(?, ?, ?)
                ON CONFLICT(telegram_id) DO UPDATE SET
                    action_type = excluded.action_type,
                    payload_json = excluded.payload_json
                """,
                (telegram_id, action_type, payload_json),
            )
            conn.commit()

    def pop_pending_action(self, telegram_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT action_type, payload_json FROM pending_actions WHERE telegram_id = ?",
                (telegram_id,),
            ).fetchone()
            if not row:
                return None
            conn.execute("DELETE FROM pending_actions WHERE telegram_id = ?", (telegram_id,))
            conn.commit()
            return {
                "action_type": row["action_type"],
                "payload": json.loads(row["payload_json"]),
            }

    def create_payment_link(self, link_id: str, amount: float, customer_name: str) -> dict[str, Any]:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO payment_links(link_id, amount, customer_name) VALUES(?, ?, ?)",
                (link_id, amount, customer_name),
            )
            conn.commit()
        return {"link_id": link_id, "amount": amount, "customer_name": customer_name, "status": "ACTIVE"}

    def get_payment_link(self, link_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT link_id, amount, customer_name, status FROM payment_links WHERE link_id = ?",
                (link_id,),
            ).fetchone()
            if not row:
                return None
            return dict(row)

    def list_orders(self, limit: int = 10) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT order_id, amount, status, created_at FROM orders ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(row) for row in rows]

    def create_refund(self, refund_id: str, txn_id: str, amount: float, status: str) -> dict[str, Any]:
        with self._connect() as conn:
            conn.execute(
                "INSERT INTO refunds(refund_id, txn_id, amount, status) VALUES(?, ?, ?, ?)",
                (refund_id, txn_id, amount, status),
            )
            conn.commit()
        return {"refund_id": refund_id, "txn_id": txn_id, "amount": amount, "status": status}

    def get_refund(self, refund_id: str) -> dict[str, Any] | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT refund_id, txn_id, amount, status FROM refunds WHERE refund_id = ?",
                (refund_id,),
            ).fetchone()
            return dict(row) if row else None

    def list_refunds(self, limit: int = 10) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT refund_id, txn_id, amount, status, created_at FROM refunds ORDER BY id DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(row) for row in rows]

    def get_settlement_summary(self) -> dict[str, Any]:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT COALESCE(SUM(gross), 0) AS gross, COALESCE(SUM(fee), 0) AS fee, COALESCE(SUM(net), 0) AS net FROM settlements"
            ).fetchone()
            return dict(row)

    def list_settlement_details(self, limit: int = 20) -> list[dict[str, Any]]:
        with self._connect() as conn:
            rows = conn.execute(
                "SELECT payout_id, payout_date, gross, fee, net FROM settlements ORDER BY payout_date DESC LIMIT ?",
                (limit,),
            ).fetchall()
            return [dict(row) for row in rows]

    def clear_mock_data(self) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM tool_audit")
            conn.execute("DELETE FROM pending_actions")
            conn.execute("DELETE FROM messages")
            conn.execute("DELETE FROM payment_links")
            conn.execute("DELETE FROM refunds")
            conn.execute("DELETE FROM payments")
            conn.execute("DELETE FROM settlements")
            conn.execute("DELETE FROM orders")
            conn.commit()

    def seed_demo_data(self, force: bool = False) -> None:
        with self._connect() as conn:
            has_orders = conn.execute("SELECT COUNT(*) AS c FROM orders").fetchone()["c"]
            if has_orders and not force:
                return
            if force:
                conn.execute("DELETE FROM payment_links")
                conn.execute("DELETE FROM refunds")
                conn.execute("DELETE FROM payments")
                conn.execute("DELETE FROM settlements")
                conn.execute("DELETE FROM orders")

            # Scenario A: Healthy day with mostly successful UPI/card payments.
            conn.execute("INSERT INTO orders(order_id, amount, status) VALUES ('ORD-1001', 799.0, 'SUCCESS')")
            conn.execute("INSERT INTO orders(order_id, amount, status) VALUES ('ORD-1002', 1299.0, 'SUCCESS')")
            conn.execute("INSERT INTO payments(txn_id, order_id, mode, status, gateway, amount) VALUES ('TXN-2001', 'ORD-1001', 'UPI', 'SUCCESS', 'MOCK_GATEWAY_A', 799.0)")
            conn.execute("INSERT INTO payments(txn_id, order_id, mode, status, gateway, amount) VALUES ('TXN-2002', 'ORD-1002', 'CC', 'SUCCESS', 'MOCK_GATEWAY_A', 1299.0)")

            # Scenario B: UPI dip and checkout failures.
            conn.execute("INSERT INTO orders(order_id, amount, status) VALUES ('ORD-1003', 499.0, 'FAILED')")
            conn.execute("INSERT INTO orders(order_id, amount, status) VALUES ('ORD-1004', 650.0, 'FAILED')")
            conn.execute("INSERT INTO payments(txn_id, order_id, mode, status, gateway, amount) VALUES ('TXN-2003', 'ORD-1003', 'UPI', 'FAILED', 'MOCK_GATEWAY_B', 499.0)")
            conn.execute("INSERT INTO payments(txn_id, order_id, mode, status, gateway, amount) VALUES ('TXN-2004', 'ORD-1004', 'UPI', 'FAILED', 'MOCK_GATEWAY_B', 650.0)")

            # Scenario C: Refund queue with mixed statuses.
            conn.execute("INSERT INTO refunds(refund_id, txn_id, amount, status) VALUES ('RFND-3001', 'TXN-2001', 99.0, 'SUCCESS')")
            conn.execute("INSERT INTO refunds(refund_id, txn_id, amount, status) VALUES ('RFND-3002', 'TXN-2004', 300.0, 'PENDING')")

            # Scenario D: Settlement delays and payout variances.
            conn.execute("INSERT INTO settlements(payout_id, payout_date, gross, fee, net) VALUES ('PAYOUT-4001', '2026-03-20', 2098.0, 42.0, 2056.0)")
            conn.execute("INSERT INTO settlements(payout_id, payout_date, gross, fee, net) VALUES ('PAYOUT-4002', '2026-03-19', 1450.0, 31.0, 1419.0)")
            conn.execute("INSERT INTO settlements(payout_id, payout_date, gross, fee, net) VALUES ('PAYOUT-4003', '2026-03-18', 980.0, 22.0, 958.0)")

            # Scenario E: Existing payment links for follow-up checks.
            conn.execute("INSERT INTO payment_links(link_id, amount, customer_name, status) VALUES ('LINK-5001', 550.0, 'Aman Traders', 'ACTIVE')")
            conn.execute("INSERT INTO payment_links(link_id, amount, customer_name, status) VALUES ('LINK-5002', 1200.0, 'Neha Retail', 'EXPIRED')")
            conn.commit()
