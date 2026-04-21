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

export interface SubscriberRow {
  telegram_id: number;
  chat_id: number;
  current_day: number;
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
    `SELECT telegram_id, chat_id, current_day
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
