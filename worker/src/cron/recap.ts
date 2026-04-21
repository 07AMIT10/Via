import type { Env } from "../env";
import { sendMessage } from "../telegram/send";
import { getPreferredLanguage } from "../db/repo";

export async function sendRecapForTelegramUser(
  env: Env,
  telegramId: number,
  chatId: number,
): Promise<boolean> {
  const row = await env.DB.prepare(
    `SELECT up.problem_id, p.title, p.canonical_approach, p.canonical_solutions_json
     FROM user_progress up
     JOIN problems p ON p.id = up.problem_id
     WHERE up.telegram_id = ?1
       AND up.status != 'solved'
     ORDER BY up.last_attempt DESC
     LIMIT 1`,
  )
    .bind(telegramId)
    .first<{
      problem_id: number;
      title: string;
      canonical_approach: string | null;
      canonical_solutions_json: string | null;
    }>();

  if (!row) {
    return false;
  }

  const lang = await getPreferredLanguage(env, telegramId);
  const solutions = JSON.parse(row.canonical_solutions_json ?? "{}") as Record<string, string>;
  const solution = solutions[lang] ?? "# Solution unavailable";
  await sendMessage(
    env,
    chatId,
    `<b>Recap</b>\n<b>${row.title}</b>\n\n${row.canonical_approach ?? "Approach unavailable."}\n\n<b>Reference solution (${lang})</b>\n<pre>${solution}</pre>`,
  );
  return true;
}

export async function runRecapCron(env: Env): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const threshold = now - 23 * 60 * 60;

  const { results } = await env.DB.prepare(
    `SELECT up.telegram_id, s.chat_id, up.problem_id, p.title, p.canonical_approach, p.canonical_solutions_json
     FROM user_progress up
     JOIN subscribers s ON s.telegram_id = up.telegram_id
     JOIN problems p ON p.id = up.problem_id
     WHERE up.recap_sent_at IS NULL
       AND up.last_attempt < ?1
       AND up.status != 'solved'
     LIMIT 50`,
  )
    .bind(threshold)
    .all<{
      telegram_id: number;
      chat_id: number;
      problem_id: number;
      title: string;
      canonical_approach: string | null;
      canonical_solutions_json: string | null;
    }>();

  for (const row of results ?? []) {
    await sendRecapForTelegramUser(env, row.telegram_id, row.chat_id);
    await env.DB.prepare(
      `UPDATE user_progress SET recap_sent_at = ?1 WHERE telegram_id = ?2 AND problem_id = ?3`,
    )
      .bind(now, row.telegram_id, row.problem_id)
      .run();
  }
}
