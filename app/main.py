from fastapi import FastAPI, Header, HTTPException

from app.agent.orchestrator import Orchestrator
from app.config import load_settings
from app.db.repo import Repository
from app.llm.client import LlmClient
from app.telegram.handler import TelegramHandler
from app.tools.mock_paytm import MockPaytmTools
from app.voice.stt import SttClient

settings = load_settings()
repo = Repository(settings.db_path)
repo.seed_demo_data()
tools = MockPaytmTools(repo)
llm_client = LlmClient(
    inference_url=settings.llm_inference_url,
    api_key=settings.llm_inference_api_key,
    model=settings.llm_model,
)
stt_client = SttClient(
    settings.stt_inference_url,
    settings.stt_api_key,
    model=settings.stt_model,
)
orchestrator = Orchestrator(repo, tools, llm_client)
telegram_handler = TelegramHandler(orchestrator, stt_client, settings.telegram_bot_token)

app = FastAPI(title="Via Copilot API", version="0.1.0")


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "Via Copilot webhook server is running!"}


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "env": settings.app_env}


@app.post("/telegram/webhook")
def telegram_webhook(
    update: dict,
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict:
    expected_secret = settings.telegram_webhook_secret
    if expected_secret and x_telegram_bot_api_secret_token != expected_secret:
        raise HTTPException(status_code=401, detail="invalid webhook secret")
    return telegram_handler.process_update(update)
