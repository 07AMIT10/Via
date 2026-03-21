from typing import Any

import requests

from app.agent.orchestrator import Orchestrator
from app.voice.stt import SttClient, SttProviderError


class TelegramHandler:
    def __init__(
        self,
        orchestrator: Orchestrator,
        stt_client: SttClient,
        bot_token: str,
    ) -> None:
        self.orchestrator = orchestrator
        self.stt_client = stt_client
        self.bot_token = bot_token

    def process_update(self, update: dict[str, Any]) -> dict[str, Any]:
        message = update.get("message") or {}
        chat = message.get("chat") or {}
        chat_id = chat.get("id")
        if chat_id is None:
            return {"ok": True, "skipped": "no_chat"}
        telegram_id = str(chat_id)

        if "text" in message:
            text = str(message.get("text", ""))
            if text.strip().lower() == "/debug last_update_type":
                last_type = self.orchestrator.repo.get_last_input_type_for_telegram_user(
                    telegram_id
                )
                current_type = "text"
                debug_msg = (
                    f"debug current_update_type={current_type}, "
                    f"last_processed_input_type={last_type or 'none'}"
                )
                self._send_message(chat_id, debug_msg)
                return {
                    "ok": True,
                    "input_type": "text",
                    "reply": debug_msg,
                    "debug": True,
                }
            reply = self.orchestrator.handle_user_text(telegram_id, text, input_type="text")
            self._send_message(chat_id, reply)
            return {"ok": True, "input_type": "text", "reply": reply}

        if "voice" in message:
            transcript = self._transcribe_media(message["voice"], "voice.ogg")
            reply = self.orchestrator.handle_user_text(
                telegram_id, transcript, input_type="voice"
            )
            self._send_message(chat_id, f"Transcribed: {transcript}\n\n{reply}")
            return {"ok": True, "input_type": "voice", "reply": reply, "transcript": transcript}

        if "audio" in message:
            transcript = self._transcribe_media(message["audio"], "audio.m4a")
            reply = self.orchestrator.handle_user_text(
                telegram_id, transcript, input_type="voice"
            )
            self._send_message(chat_id, f"Transcribed: {transcript}\n\n{reply}")
            return {"ok": True, "input_type": "voice", "reply": reply, "transcript": transcript}

        return {"ok": True, "skipped": "unsupported_message_type"}

    def _transcribe_media(self, media_obj: dict[str, Any], default_filename: str) -> str:
        file_id = media_obj.get("file_id")
        if not file_id or not self.bot_token:
            return "voice transcription unavailable in local mode"
        try:
            file_resp = requests.get(
                f"https://api.telegram.org/bot{self.bot_token}/getFile",
                params={"file_id": file_id},
                timeout=20,
            )
            file_resp.raise_for_status()
            file_path = file_resp.json().get("result", {}).get("file_path")
            if not file_path:
                return "unable to fetch media file path from Telegram"

            dl_resp = requests.get(
                f"https://api.telegram.org/file/bot{self.bot_token}/{file_path}", timeout=30
            )
            dl_resp.raise_for_status()
            filename = file_path.split("/")[-1] if "/" in file_path else default_filename
            if "." not in filename:
                filename = default_filename
            transcript = self.stt_client.transcribe_bytes(dl_resp.content, filename=filename)
            return transcript or "empty transcription"
        except SttProviderError as exc:
            return (
                "voice transcription failed. "
                f"provider_detail={exc}. "
                "Tip: Telegram voice notes are usually OGG; if this keeps failing, send an audio file in m4a/mp3."
            )
        except requests.RequestException:
            return "voice transcription failed due to Telegram network issue"

    def _send_message(self, chat_id: int, text: str) -> None:
        if not self.bot_token:
            return
        try:
            requests.post(
                f"https://api.telegram.org/bot{self.bot_token}/sendMessage",
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"},
                timeout=20,
            )
        except requests.RequestException:
            return
