import type { Env } from "../env";
import { recordSubmission } from "../db/repo";
import { runJudge0 } from "../judge0/client";
import { verifyTelegramInitData } from "./middleware";

interface SubmitIncoming {
  problemId?: number;
  language?: "python" | "go" | "rust";
  code?: string;
  mode?: "run" | "submit";
}

export async function handleSubmit(
  request: Request,
  env: Env,
): Promise<Response> {
  const auth = await verifyTelegramInitData(env, request);
  if (!auth.ok) {
    return auth.response;
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response("bad request", { status: 400 });
  }
  const incoming = body as SubmitIncoming;
  if (
    typeof incoming.problemId !== "number" ||
    !incoming.language ||
    !incoming.code
  ) {
    return new Response("bad request", { status: 400 });
  }

  const isRun = incoming.mode === "run";
  const judge = await runJudge0(env, {
    language: incoming.language,
    code: incoming.code,
    wait: true,
  });
  const verdict = judge.verdict === "stub"
    ? (isRun ? "run-ok" : "accepted-stub")
    : judge.verdict;
  const output = judge.verdict === "stub"
    ? (
        isRun
          ? "Run complete (stub). Judge0 run mode will execute sample tests in Week 4."
          : "Submit accepted (stub). Judge0 graded verdict arrives in Week 4."
      )
    : judge.output;

  const solved =
    verdict === "accepted" ||
    verdict === "accepted-stub";

  await recordSubmission(env, {
    telegramId: auth.context.telegramId,
    problemId: incoming.problemId,
    language: incoming.language,
    code: incoming.code,
    output,
    verdict,
    status: solved ? "solved" : "attempted",
    advanceDay: !isRun && solved,
  });

  return Response.json({
    verdict,
    output,
    telegram_id: auth.context.telegramId,
    status_id: judge.status_id,
    judge_source: judge.judge_source,
  });
}
