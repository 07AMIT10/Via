from typing import Any

import requests


class LlmClient:
    def __init__(self, inference_url: str, api_key: str, model: str) -> None:
        self.inference_url = inference_url
        self.api_key = api_key
        self.model = model

    def generate(self, prompt: str, history: list[dict[str, str]] | None = None) -> str:
        if not self.inference_url:
            return "I can help with orders, links, refunds, and settlements. Tell me what you want to check."
        try:
            payload = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": (
                        "You are Via, a merchant's payment copilot on Telegram.\n\n"
                        "RULES:\n"
                        "- Be brief. 2-3 lines by default. Only expand if the user asks "
                        "\"tell me more\", \"details\", or \"explain\".\n"
                        "- Use Telegram HTML formatting ONLY (never markdown):\n"
                        "  <b>bold</b> for key numbers and labels,\n"
                        "  <i>italic</i> for emphasis,\n"
                        "  <code>TXN-2001</code> for IDs.\n"
                        "- Lead with the answer. No preamble like \"Here are my insights:\" "
                        "or \"Based on the data:\".\n"
                        "- Sound human — like a sharp assistant texting, not an AI writing "
                        "a report. No bullet-point essays.\n"
                        "- Use ₹ for currency (Indian merchants).\n"
                        "- If data shows a problem, state it plainly and offer ONE actionable "
                        "next step — not a 10-point plan.\n"
                        "- Use line breaks to separate thoughts. Never use markdown "
                        "(**, ##, -). Only HTML tags.\n"
                        "- Emojis sparingly: ✅ ❌ ⚠️ 📊 for status indicators only.\n"
                        "- Never end with \"Let me know if you'd like me to elaborate\" or "
                        "similar filler.\n"
                        "- NEVER make up data, transaction IDs, or order details.\n"
                        "- If you do not have the requested information in your chat history, "
                        "explicitly state that you don't know or ask the user to provide the exact ID."
                    )},
                    *(history or []),
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0.0,
            }
            headers: dict[str, Any] = {"Content-Type": "application/json"}
            if self.api_key:
                headers["Authorization"] = f"Bearer {self.api_key}"
            response = requests.post(
                self._normalize_chat_url(self.inference_url),
                json=payload,
                headers=headers,
                timeout=20,
            )
            response.raise_for_status()
            data = response.json()
        except requests.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else "unknown"
            return (
                f"LLM provider returned HTTP {status}. "
                "Please check API key permissions/quota. I can still run mocked tools "
                "for orders, links, refunds, and settlements."
            )
        except requests.RequestException:
            return (
                "LLM provider is currently unreachable. "
                "I can still run mocked tools for orders, links, refunds, and settlements."
            )

        if isinstance(data, dict) and "success" in data:
            if not data.get("success"):
                return (
                    f"LLM provider error: {data.get('error', 'unknown_error')}. "
                    "I can still run mocked tools for orders, links, refunds, and settlements."
                )
            try:
                return data["data"]["choices"][0]["message"]["content"]
            except (KeyError, IndexError, TypeError):
                return str(data.get("data", data))
        try:
            return data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError):
            return str(data)

    @staticmethod
    def _normalize_chat_url(url: str) -> str:
        normalized = (url or "").rstrip("/")
        if normalized.endswith("/chat/completions"):
            return normalized
        if normalized.endswith("/openai/v1"):
            return f"{normalized}/chat/completions"
        return normalized
