import type { Env } from "../env";
import { getProblemByDay, getProblemById, getSubscriberByTelegramId } from "../db/repo";
import { verifyTelegramInitData } from "./middleware";

export async function handleTodayProblem(
  request: Request,
  env: Env,
): Promise<Response> {
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

export async function handleProblemById(
  request: Request,
  env: Env,
  path: string,
): Promise<Response> {
  const auth = await verifyTelegramInitData(env, request);
  if (!auth.ok) {
    return auth.response;
  }
  const id = Number(path.replace("/api/problem/", ""));
  if (Number.isNaN(id)) {
    return new Response("bad request", { status: 400 });
  }
  const problem = await getProblemById(env, id);
  if (!problem) {
    return new Response("not found", { status: 404 });
  }
  return Response.json(problem);
}
