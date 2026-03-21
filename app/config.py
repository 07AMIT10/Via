import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    app_env: str
    telegram_bot_token: str
    telegram_webhook_secret: str
    llm_inference_url: str
    llm_inference_api_key: str
    llm_model: str
    stt_inference_url: str
    stt_api_key: str
    stt_model: str
    db_path: str


def load_settings() -> Settings:
    groq_key = os.getenv("GROQ_API_KEY", "")
    llm_key = os.getenv("LLM_INFERENCE_API_KEY", "") or groq_key
    stt_key = os.getenv("STT_API_KEY", "") or llm_key or groq_key
    return Settings(
        app_env=os.getenv("APP_ENV", "dev"),
        telegram_bot_token=os.getenv("TELEGRAM_BOT_TOKEN", ""),
        telegram_webhook_secret=os.getenv("TELEGRAM_WEBHOOK_SECRET", "local-secret"),
        llm_inference_url=os.getenv(
            "LLM_INFERENCE_URL", "https://api.groq.com/openai/v1/chat/completions"
        ),
        llm_inference_api_key=llm_key,
        llm_model=os.getenv("LLM_MODEL", "llama-3.3-70b-versatile"),
        stt_inference_url=os.getenv(
            "STT_INFERENCE_URL", "https://api.groq.com/openai/v1/audio/transcriptions"
        ),
        stt_api_key=stt_key,
        stt_model=os.getenv("STT_MODEL", "whisper-large-v3-turbo"),
        db_path=os.getenv("DB_PATH", "via.sqlite3"),
    )
