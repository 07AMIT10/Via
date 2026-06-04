import type { Env } from "../env";
import type { ProblemRow } from "./repo";
import { getProblemByDay, getProblemBySlug } from "./repo";

export interface BrowsableProblem {
  day_number: number;
  slug: string;
  title: string;
}

export async function listBrowsableProblems(env: Env): Promise<BrowsableProblem[]> {
  const res = await env.DB.prepare(
    `SELECT day_number, slug, title
     FROM problems
     ORDER BY day_number ASC`,
  ).all<BrowsableProblem>();
  return res.results ?? [];
}

export function adjacentBrowsable(
  catalog: BrowsableProblem[],
  day: number,
  direction: "next" | "prev",
): BrowsableProblem | null {
  if (catalog.length === 0) {
    return null;
  }
  const index = catalog.findIndex((p) => p.day_number === day);
  const start = index >= 0 ? index : 0;
  const nextIndex = direction === "next" ? start + 1 : start - 1;
  if (nextIndex < 0 || nextIndex >= catalog.length) {
    return null;
  }
  return catalog[nextIndex] ?? null;
}

export function resolveBrowseAnchor(
  catalog: BrowsableProblem[],
  browseDay: number | null | undefined,
  currentDay: number,
): number {
  if (browseDay != null && catalog.some((p) => p.day_number === browseDay)) {
    return browseDay;
  }
  if (catalog.some((p) => p.day_number === currentDay)) {
    return currentDay;
  }
  return catalog[0]?.day_number ?? currentDay;
}

export async function setBrowseDay(
  env: Env,
  telegramId: number,
  day: number,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE subscribers SET browse_day = ?1 WHERE telegram_id = ?2`,
  )
    .bind(day, telegramId)
    .run();
}

export async function getBrowseDay(
  env: Env,
  telegramId: number,
): Promise<number | null> {
  const row = await env.DB.prepare(
    `SELECT browse_day FROM subscribers WHERE telegram_id = ?1`,
  )
    .bind(telegramId)
    .first<{ browse_day: number | null }>();
  return row?.browse_day ?? null;
}

export async function loadProblemForBrowse(
  env: Env,
  entry: BrowsableProblem,
): Promise<ProblemRow | null> {
  return getProblemBySlug(env, entry.slug) ?? getProblemByDay(env, entry.day_number);
}
