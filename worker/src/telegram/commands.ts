import type { Env } from "../env";
import { sendMessage } from "./send";
import {
  getProgressCounts,
  getStreak,
  getSubscriberByTelegramId,
} from "../db/repo";
import { sendRecapForTelegramUser } from "../cron/recap";
import {
  sendBrowseMenu,
  sendBrowseStep,
  sendTodayProblem,
} from "./browse.js";

async function upsertSubscriber(
  env: Env,
  telegramId: number,
  chatId: number,
  username: string | null,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO subscribers (telegram_id, chat_id, username, active)
     VALUES (?1, ?2, ?3, 1)
     ON CONFLICT(telegram_id) DO UPDATE SET
       chat_id = excluded.chat_id,
       username = excluded.username`,
  )
    .bind(telegramId, chatId, username)
    .run();
}

export async function handleCommand(
  env: Env,
  command: string,
  rawText: string,
  telegramId: number,
  chatId: number,
  username: string | null,
): Promise<void> {
  switch (command) {
    case "/start":
      await upsertSubscriber(env, telegramId, chatId, username);
      await sendMessage(
        env,
        chatId,
        "<b>Welcome to DSA Daily</b>\nUse /today for your curriculum day, /browse to pick any problem, or /next to move through the catalog. Buttons appear under each problem.",
      );
      return;
    case "/today":
      await sendTodayProblem(env, chatId, telegramId);
      return;
    case "/next":
      await sendBrowseStep(env, chatId, telegramId, "next");
      return;
    case "/browse":
      await sendBrowseMenu(env, chatId);
      return;
    case "/progress":
      {
        const stats = await getProgressCounts(env, telegramId);
        const sub = await getSubscriberByTelegramId(env, telegramId);
        const streak = await getStreak(env, telegramId);
        const nextDay = sub?.current_day ?? 1;
        const lang = sub?.preferred_language ?? "python";
        await sendMessage(
          env,
          chatId,
          `<b>Your progress</b>\nSolved: <b>${stats.solved}</b>\nAttempted: <b>${stats.attempted}</b>\nRead: <b>${stats.read}</b>\nSkipped: <b>${stats.skipped}</b>\nCurrent streak: <b>${streak}</b> day(s)\nNext day: <b>${nextDay}</b>\nPreferred language: <b>${lang}</b>`,
        );
      }
      return;
    case "/recap":
      {
        const sent = await sendRecapForTelegramUser(env, telegramId, chatId);
        if (!sent) {
          await sendMessage(env, chatId, "No recap available yet. Attempt or read a problem first.");
        }
      }
      return;
    case "/pause":
      await env.DB.prepare("UPDATE subscribers SET active = 0 WHERE telegram_id = ?1")
        .bind(telegramId)
        .run();
      await sendMessage(env, chatId, "Paused daily delivery. Use /resume anytime.");
      return;
    case "/resume":
      await env.DB.prepare("UPDATE subscribers SET active = 1 WHERE telegram_id = ?1")
        .bind(telegramId)
        .run();
      await sendMessage(env, chatId, "Resumed. You will receive daily digests.");
      return;
    default:
      if (command === "/lang") {
        const pieces = rawText.trim().split(/\s+/);
        const selected = pieces[1] as "python" | "go" | "rust" | undefined;
        if (!selected || !["python", "go", "rust"].includes(selected)) {
          await sendMessage(env, chatId, "Invalid language. Use `/lang python`, `/lang go`, or `/lang rust`.");
          return;
        }
        await env.DB.prepare(
          "UPDATE subscribers SET preferred_language = ?1 WHERE telegram_id = ?2",
        )
          .bind(selected, telegramId)
          .run();
        await sendMessage(env, chatId, `Preferred language set to <b>${selected}</b>.`);
        return;
      }
      await sendMessage(
        env,
        chatId,
        "Unknown command. Try /start, /today, /next, /browse, /progress, /pause, /resume, /recap, or /lang.",
      );
  }
}
