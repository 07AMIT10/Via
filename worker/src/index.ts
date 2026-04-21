import type { ScheduledController } from "@cloudflare/workers-types";
import type { Env } from "./env";
import { processTelegramUpdate } from "./telegram/webhook";
import { runRecapCron } from "./cron/recap";
import { runDailyBroadcastCron } from "./cron/daily-broadcast";
import { handleBroadcastQueue } from "./queue/broadcast-consumer";
import { getProblemByDay, getSubscriberByTelegramId } from "./db/repo";
import { verifyTelegramInitData } from "./api/middleware";

function unauthorized(): Response {
  return new Response("unauthorized", { status: 401 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, service: "dsa-bot-worker" });
    }

    if (url.pathname === "/api/today" && request.method === "GET") {
      const auth = await verifyTelegramInitData(env, request);
      if (!auth.ok) {
        return auth.response;
      }
      const telegramId = auth.context.telegramId;
      const sub = await getSubscriberByTelegramId(env, telegramId);
      const day = sub?.current_day ?? 1;
      const problem = await getProblemByDay(env, day);
      if (!problem) {
        return new Response("not found", { status: 404 });
      }
      return Response.json(problem);
    }

    if (url.pathname === "/api/submit" && request.method === "POST") {
      const auth = await verifyTelegramInitData(env, request);
      if (!auth.ok) {
        return auth.response;
      }
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return new Response("bad request", { status: 400 });
      }
      return Response.json({
        verdict: "queued",
        output: "Submission accepted. Judge0 integration lands in Week 4.",
        telegram_id: auth.context.telegramId,
      });
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

  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    const cron = controller.cron;
    if (cron === "0 13 * * *") {
      await runDailyBroadcastCron(env);
      return;
    }
    if (cron === "30 13 * * *") {
      await runRecapCron(env);
    }
  },

  async queue(batch, env): Promise<void> {
    await handleBroadcastQueue(env, batch);
  },
};
