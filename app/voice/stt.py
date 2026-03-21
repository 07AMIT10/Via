from typing import Any

import requests


class SttProviderError(Exception):
    pass


class SttClient:
    def __init__(self, inference_url: str, api_key: str, model: str = "whisper-large-v3") -> None:
        self.inference_url = inference_url
        self.api_key = api_key
        self.model = model

    def transcribe_bytes(self, audio_bytes: bytes, filename: str = "voice.ogg") -> str:
        if not self.inference_url:
            return "voice transcription unavailable in local mode"
        headers: dict[str, Any] = {}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        data = {
            "model": self.model,
            "response_format": "verbose_json",
            "temperature": "0",
        }
        safe_filename = self._ensure_supported_extension(filename)
        mime_candidates = [None] + self._mime_candidates(safe_filename)
        last_error: str | None = None
        for mime in mime_candidates:
            try:
                if mime is None:
                    files = {"file": (safe_filename, audio_bytes)}
                else:
                    files = {"file": (safe_filename, audio_bytes, mime)}
                response = requests.post(
                    self.inference_url, headers=headers, files=files, data=data, timeout=40
                )
                response.raise_for_status()
                payload = response.json()
                text = str(payload.get("text", "")).strip()
                if text:
                    return text
                return "empty transcription"
            except requests.HTTPError as exc:
                status = exc.response.status_code if exc.response is not None else "unknown"
                body = ""
                if exc.response is not None:
                    body = exc.response.text[:300]
                last_error = f"stt_http_{status}: {body}"
            except requests.RequestException as exc:
                last_error = f"stt_network_error: {exc}"
        raise SttProviderError(last_error or "stt_unknown_error")

    @staticmethod
    def _mime_candidates(filename: str) -> list[str]:
        lower = (filename or "").lower()
        if lower.endswith(".ogg") or lower.endswith(".oga"):
            # Telegram voice notes are typically OGG/OPUS.
            return ["audio/ogg", "audio/webm", "application/octet-stream"]
        if lower.endswith(".opus"):
            return ["audio/ogg", "application/octet-stream"]
        if lower.endswith(".mp3"):
            return ["audio/mpeg", "application/octet-stream"]
        if lower.endswith(".m4a"):
            return ["audio/mp4", "application/octet-stream"]
        if lower.endswith(".wav"):
            return ["audio/wav", "application/octet-stream"]
        return ["application/octet-stream"]

    @staticmethod
    def _ensure_supported_extension(filename: str) -> str:
        lower = (filename or "").lower()
        supported = (".flac", ".mp3", ".mp4", ".mpeg", ".mpga", ".m4a", ".ogg", ".opus", ".wav", ".webm")
        if any(lower.endswith(ext) for ext in supported):
            return filename
        return "voice.ogg"
