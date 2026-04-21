import type { Env } from "../env";
import { answerCallbackQuery, sendMessage } from "./send";
import { getProblemById, getPreferredLanguage } from "../db/repo";

function parseCallbackData(data: string): { action: string; problemId: number; payload?: string } | null {
  const [action, rawId, payload] = data.split(":");
  const problemId = Number(rawId);
  if (!action || Number.isNaN(problemId)) {
    return null;
  }
  return { action, problemId, payload };
}

export async function handleCallback(
  env: Env,
  callbackQueryId: string,
  chatId: number,
  telegramId: number,
  data: string,
): Promise<void> {
  const parsed = parseCallbackData(data);
  if (!parsed) {
    await answerCallbackQuery(env, callbackQueryId, "Unsupported action");
    return;
  }

  switch (parsed.action) {
    case "h":
      {
        const problem = await getProblemById(env, parsed.problemId);
        const hints = JSON.parse(problem?.hints_json ?? "[]") as string[];
        const requestedHint = Math.min(3, Math.max(1, Number(parsed.payload ?? "1")));
        const hintText = hints[requestedHint - 1] ?? "No more hints available for this problem.";
        await env.DB.prepare(
          `INSERT INTO user_progress (telegram_id, problem_id, status, hints_used)
           VALUES (?1, ?2, 'read', ?3)
           ON CONFLICT(telegram_id, problem_id) DO UPDATE SET hints_used = max(hints_used, excluded.hints_used)`,
        )
          .bind(telegramId, parsed.problemId, requestedHint)
          .run();
        await answerCallbackQuery(env, callbackQueryId, `Hint ${requestedHint} unlocked`);
        await sendMessage(env, chatId, `<b>Hint ${requestedHint}</b>\n${hintText}`);
      }
      return;
    case "n":
      await env.DB.prepare(
        `UPDATE user_progress
         SET hints_used = min(3, hints_used + 1)
         WHERE telegram_id = ?1 AND problem_id = ?2`,
      )
        .bind(telegramId, parsed.problemId)
        .run();
      await answerCallbackQuery(env, callbackQueryId, "Use Hint button again");
      return;
    case "r":
      await env.DB.prepare(
        `INSERT INTO user_progress (telegram_id, problem_id, status)
         VALUES (?1, ?2, 'read')
         ON CONFLICT(telegram_id, problem_id) DO UPDATE SET status = 'read'`,
      )
        .bind(telegramId, parsed.problemId)
        .run();
      await answerCallbackQuery(env, callbackQueryId, "Marked as read");
      return;
    case "a":
      {
        const problem = await getProblemById(env, parsed.problemId);
        const approach =
          problem?.canonical_approach ??
          "Define a clear invariant, maintain it through each step, and avoid recomputing state.";
        await env.DB.prepare(
          `INSERT INTO user_progress (telegram_id, problem_id, status, approach_shown)
           VALUES (?1, ?2, 'read', 1)
           ON CONFLICT(telegram_id, problem_id) DO UPDATE SET approach_shown = 1`,
        )
          .bind(telegramId, parsed.problemId)
          .run();
        await answerCallbackQuery(env, callbackQueryId, "Approach unlocked");
        await sendMessage(env, chatId, `<b>Canonical approach</b>\n${approach}`);
      }
      return;
    case "s":
      {
        const progress = await env.DB.prepare(
          `SELECT approach_shown, last_attempt
           FROM user_progress
           WHERE telegram_id = ?1 AND problem_id = ?2`,
        )
          .bind(telegramId, parsed.problemId)
          .first<{ approach_shown: number | null; last_attempt: number | null }>();
        const canReveal =
          (progress?.approach_shown ?? 0) === 1 ||
          (progress?.last_attempt ?? 0) < Math.floor(Date.now() / 1000) - 24 * 60 * 60;

        if (!canReveal) {
          await answerCallbackQuery(env, callbackQueryId, "Reveal approach first or wait 24h");
          return;
        }

        const problem = await getProblemById(env, parsed.problemId);
        const lang = await getPreferredLanguage(env, telegramId);
        const solutions = JSON.parse(problem?.canonical_solutions_json ?? "{}") as Record<string, string>;
        const code = solutions[lang] ?? "# Solution unavailable";
        await answerCallbackQuery(env, callbackQueryId, "Solution unlocked");
        await sendMessage(env, chatId, `<b>Reference solution (${lang})</b>\n<pre>${code}</pre>`);
      }
      return;
    case "m":
      await env.DB.prepare(
        `INSERT INTO user_progress (telegram_id, problem_id, status)
         VALUES (?1, ?2, 'attempted')
         ON CONFLICT(telegram_id, problem_id) DO UPDATE SET status = 'attempted'`,
      )
        .bind(telegramId, parsed.problemId)
        .run();
      await answerCallbackQuery(env, callbackQueryId, "Marked as attempted");
      return;
    case "k":
      await env.DB.prepare(
        `INSERT INTO user_progress (telegram_id, problem_id, status)
         VALUES (?1, ?2, 'skipped')
         ON CONFLICT(telegram_id, problem_id) DO UPDATE SET status = 'skipped'`,
      )
        .bind(telegramId, parsed.problemId)
        .run();
      await answerCallbackQuery(env, callbackQueryId, "Skipped for today");
      return;
    default:
      await answerCallbackQuery(env, callbackQueryId, "Unknown action");
  }
}
