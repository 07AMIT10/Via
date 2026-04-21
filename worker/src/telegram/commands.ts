import type { Env } from "../env";
import { sendMessage } from "./send";
import { digestKeyboard, renderDigest } from "./digest";
import {
  getProblemByDay,
  getProgressCounts,
  getStreak,
  getSubscriberByTelegramId,
} from "../db/repo";
import { sendRecapForTelegramUser } from "../cron/recap";

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
        "<b>Welcome to DSA Daily</b>\nYou are subscribed. Use /today to fetch today's problem.",
      );
      return;
    case "/today":
      {
        const subscriber = await getSubscriberByTelegramId(env, telegramId);
        const day = subscriber?.current_day ?? 1;
        const problem = await getProblemByDay(env, day);
        if (!problem) {
          await sendMessage(env, chatId, "No problem found for today. Run ingestion and try again.");
          return;
        }
        const digest = renderDigest({
          day: problem.day_number,
          pattern: problem.pattern,
          difficulty: problem.difficulty,
          title: problem.title,
          description: problem.description,
          keyInsight: problem.key_insight ?? "Identify the invariant that lets you avoid repeated work.",
          whyItMatters: problem.why_it_matters ?? "This pattern appears frequently in interviews and real systems.",
          applications: JSON.parse(problem.applications_json ?? "[]"),
          variations: (JSON.parse(problem.variations_json ?? "[]") as Array<{ title: string; one_liner: string }>).map((v) => ({
            title: v.title,
            oneLiner: v.one_liner,
          })),
          complexity: problem.complexity ?? "Aim for linear or near-linear complexity.",
        });
        await sendMessage(env, chatId, digest, digestKeyboard(problem.id, env.PAGES_URL));
      }
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
        "Unknown command. Try /start, /today, /progress, /pause, /resume, /recap, or /lang.",
      );
  }
}
