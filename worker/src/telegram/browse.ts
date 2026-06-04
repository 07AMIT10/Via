import type { Env } from "../env";
import {
  adjacentBrowsable,
  getBrowseDay,
  listBrowsableProblems,
  loadProblemForBrowse,
  resolveBrowseAnchor,
  setBrowseDay,
} from "../db/browse.js";
import { getProblemByDay, getSubscriberByTelegramId } from "../db/repo";
import { browseListKeyboard } from "./keyboards.js";
import { sendProblemDigest } from "./problem-delivery.js";
import { sendMessage } from "./send";

export async function sendBrowseMenu(env: Env, chatId: number): Promise<void> {
  const catalog = await listBrowsableProblems(env);
  if (catalog.length === 0) {
    await sendMessage(env, chatId, "No problems in the database yet. Run content ingest and seed D1.");
    return;
  }
  await sendMessage(
    env,
    chatId,
    "<b>Pick a problem</b>\nTap a day below (same digest + hints + approaches as /today).",
    browseListKeyboard(catalog),
  );
}

export async function sendTodayProblem(
  env: Env,
  chatId: number,
  telegramId: number,
): Promise<boolean> {
  const subscriber = await getSubscriberByTelegramId(env, telegramId);
  const day = subscriber?.current_day ?? 1;
  const problem = await getProblemByDay(env, day);
  if (!problem) {
    await sendMessage(env, chatId, "No problem found for today. Run ingestion and try again.");
    return false;
  }
  await setBrowseDay(env, telegramId, day);
  await sendProblemDigest(env, chatId, problem);
  return true;
}

export async function sendBrowseStep(
  env: Env,
  chatId: number,
  telegramId: number,
  direction: "next" | "prev",
): Promise<void> {
  const catalog = await listBrowsableProblems(env);
  if (catalog.length === 0) {
    await sendMessage(env, chatId, "No problems available to browse.");
    return;
  }
  const subscriber = await getSubscriberByTelegramId(env, telegramId);
  const anchor = resolveBrowseAnchor(
    catalog,
    await getBrowseDay(env, telegramId),
    subscriber?.current_day ?? 1,
  );
  const target = adjacentBrowsable(catalog, anchor, direction);
  if (!target) {
    const label = direction === "next" ? "last" : "first";
    await sendMessage(env, chatId, `You are at the ${label} problem in the catalog.`);
    return;
  }
  const problem = await loadProblemForBrowse(env, target);
  if (!problem) {
    await sendMessage(env, chatId, "Problem not found in database.");
    return;
  }
  await setBrowseDay(env, telegramId, target.day_number);
  await sendProblemDigest(env, chatId, problem);
}

export async function sendProblemBySlug(
  env: Env,
  chatId: number,
  telegramId: number,
  slug: string,
): Promise<void> {
  const catalog = await listBrowsableProblems(env);
  const entry = catalog.find((p) => p.slug === slug);
  if (!entry) {
    await sendMessage(env, chatId, "Unknown problem.");
    return;
  }
  const problem = await loadProblemForBrowse(env, entry);
  if (!problem) {
    await sendMessage(env, chatId, "Problem not found in database.");
    return;
  }
  await setBrowseDay(env, telegramId, entry.day_number);
  await sendProblemDigest(env, chatId, problem);
}
