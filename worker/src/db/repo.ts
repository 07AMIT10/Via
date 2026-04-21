import type { Env } from "../env";

export interface ProblemRow {
  id: number;
  day_number: number;
  title: string;
  description: string;
  pattern: string;
  difficulty: string;
  key_insight: string | null;
  why_it_matters: string | null;
  applications_json: string | null;
  variations_json: string | null;
  complexity: string | null;
  hints_json: string | null;
  canonical_approach: string | null;
  canonical_solutions_json: string | null;
}

export interface SubmitPayload {
  telegramId: number;
  problemId: number;
  language: "python" | "go" | "rust";
  code: string;
  output: string;
  verdict: string;
  status: "attempted" | "solved";
  advanceDay: boolean;
}

export interface SubscriberRow {
  telegram_id: number;
  chat_id: number;
  current_day: number;
  preferred_language?: "python" | "go" | "rust" | null;
}

export async function getProblemByDay(
  env: Env,
  day: number,
): Promise<ProblemRow | null> {
  const result = await env.DB.prepare(
    `SELECT id, day_number, title, description, pattern, difficulty, key_insight,
            why_it_matters, applications_json, variations_json, complexity, hints_json,
            canonical_approach, canonical_solutions_json
     FROM problems
     WHERE day_number = ?1
     LIMIT 1`,
  )
    .bind(day)
    .first<ProblemRow>();

  return result ?? null;
}

export async function getSubscriberByTelegramId(
  env: Env,
  telegramId: number,
): Promise<SubscriberRow | null> {
  const result = await env.DB.prepare(
    `SELECT telegram_id, chat_id, current_day, preferred_language
     FROM subscribers
     WHERE telegram_id = ?1`,
  )
    .bind(telegramId)
    .first<SubscriberRow>();

  return result ?? null;
}

export async function listActiveSubscribers(
  env: Env,
): Promise<SubscriberRow[]> {
  const res = await env.DB.prepare(
    `SELECT telegram_id, chat_id, current_day
     FROM subscribers
     WHERE active = 1`,
  ).all<SubscriberRow>();
  return res.results ?? [];
}

export async function getProgressCounts(
  env: Env,
  telegramId: number,
): Promise<{ solved: number; read: number; skipped: number; attempted: number }> {
  const row = await env.DB.prepare(
    `SELECT
      SUM(CASE WHEN status = 'solved' THEN 1 ELSE 0 END) AS solved,
      SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) AS read,
      SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) AS skipped,
      SUM(CASE WHEN status = 'attempted' THEN 1 ELSE 0 END) AS attempted
     FROM user_progress
     WHERE telegram_id = ?1`,
  )
    .bind(telegramId)
    .first<{ solved: number | null; read: number | null; skipped: number | null; attempted: number | null }>();

  return {
    solved: row?.solved ?? 0,
    read: row?.read ?? 0,
    skipped: row?.skipped ?? 0,
    attempted: row?.attempted ?? 0,
  };
}

export async function getStreak(
  env: Env,
  telegramId: number,
): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT date(last_attempt, 'unixepoch') AS d
     FROM user_progress
     WHERE telegram_id = ?1
       AND status = 'solved'
     ORDER BY d DESC
     LIMIT 60`,
  )
    .bind(telegramId)
    .all<{ d: string }>();

  const days = (results ?? []).map((r) => r.d);
  if (days.length === 0) {
    return 0;
  }

  let streak = 0;
  let cursor = new Date();
  for (const day of days) {
    const expected = cursor.toISOString().slice(0, 10);
    if (day === expected) {
      streak += 1;
      cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
      continue;
    }
    if (streak === 0) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      if (day === yesterday) {
        streak += 1;
        cursor = new Date(cursor.getTime() - 2 * 24 * 60 * 60 * 1000);
        continue;
      }
    }
    break;
  }

  return streak;
}

export async function getProblemById(
  env: Env,
  problemId: number,
): Promise<ProblemRow | null> {
  const result = await env.DB.prepare(
    `SELECT id, day_number, title, description, pattern, difficulty, key_insight,
            why_it_matters, applications_json, variations_json, complexity, hints_json,
            canonical_approach, canonical_solutions_json
     FROM problems
     WHERE id = ?1
     LIMIT 1`,
  )
    .bind(problemId)
    .first<ProblemRow>();

  return result ?? null;
}

export async function getPreferredLanguage(
  env: Env,
  telegramId: number,
): Promise<"python" | "go" | "rust"> {
  const row = await env.DB.prepare(
    `SELECT preferred_language FROM subscribers WHERE telegram_id = ?1`,
  )
    .bind(telegramId)
    .first<{ preferred_language: "python" | "go" | "rust" | null }>();

  return row?.preferred_language ?? "python";
}

export async function recordSubmission(
  env: Env,
  payload: SubmitPayload,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO user_progress (
      telegram_id, problem_id, status, language, last_code, last_stdout, attempts, last_attempt
     ) VALUES (
      ?1, ?2, ?3, ?4, ?5, ?6, 1, unixepoch()
     )
     ON CONFLICT(telegram_id, problem_id) DO UPDATE SET
      status = CASE
        WHEN excluded.status = 'attempted' AND user_progress.status = 'solved' THEN 'solved'
        ELSE excluded.status
      END,
      language = excluded.language,
      last_code = excluded.last_code,
      last_stdout = excluded.last_stdout,
      attempts = user_progress.attempts + 1,
      last_attempt = unixepoch()`,
  )
    .bind(
      payload.telegramId,
      payload.problemId,
      payload.status,
      payload.language,
      payload.code,
      payload.output,
    )
    .run();

  await env.DB.prepare(
    `INSERT INTO submissions_log (telegram_id, problem_id, language, verdict, created_at)
     VALUES (?1, ?2, ?3, ?4, unixepoch())`,
  )
    .bind(payload.telegramId, payload.problemId, payload.language, payload.verdict)
    .run();

  if (payload.advanceDay) {
    await env.DB.prepare(
      `UPDATE subscribers
       SET current_day = current_day + 1
       WHERE telegram_id = ?1
         AND current_day = (
           SELECT day_number
           FROM problems
           WHERE id = ?2
           LIMIT 1
         )`,
    )
      .bind(payload.telegramId, payload.problemId)
      .run();
  }
}
