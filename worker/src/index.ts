import type { Env } from "./env";
import { processTelegramUpdate } from "./telegram/webhook";

function unauthorized(): Response {
  return new Response("unauthorized", { status: 401 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "dsa-bot-worker" });
    }

    if (url.pathname === "/telegram/webhook" && request.method === "POST") {
      const token = request.headers.get("x-telegram-bot-api-secret-token");
      if (token !== env.TELEGRAM_WEBHOOK_SECRET) {
        return unauthorized();
      }
      const body = await request.json();
      return processTelegramUpdate(env, body);
    }

    return new Response("not found", { status: 404 });
  },

  async scheduled(): Promise<void> {
    return;
  },

  async queue(): Promise<void> {
    return;
  },
};
