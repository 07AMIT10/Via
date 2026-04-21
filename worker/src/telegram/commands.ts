import type { Env } from "../env";
import { sendMessage } from "./send";

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
        "<b>Welcome to DSA Daily</b>\nYou are subscribed. Use /today to fetch today's problem.",
      );
      return;
    case "/today":
      await sendMessage(
        env,
        chatId,
        "<b>Today's digest</b>\nThis will be wired to the rich problem digest in Week 2.",
      );
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
      await sendMessage(
        env,
        chatId,
        "Unknown command. Try /start, /today, /pause, or /resume.",
      );
  }
}
