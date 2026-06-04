import type { Env } from "../env";
import type { ProblemRow } from "../db/repo";
import { parseProblemContent } from "../content/parse.js";
import { projectDigest } from "../content/projections.js";
import { renderDigest } from "./digest";
import { digestKeyboardWithNav } from "./keyboards.js";
import { sendMessage } from "./send";

export function buildDigestMessage(problem: ProblemRow): string {
  const doc = parseProblemContent(problem.content_json);
  if (doc) {
    return projectDigest(doc).html;
  }
  return renderDigest({
    day: problem.day_number,
    pattern: problem.pattern,
    difficulty: problem.difficulty,
    title: problem.title,
    description: problem.description,
    keyInsight:
      problem.key_insight ??
      "Identify the invariant that lets you avoid repeated work.",
    whyItMatters:
      problem.why_it_matters ??
      "This pattern appears frequently in interviews and real systems.",
    applications: JSON.parse(problem.applications_json ?? "[]"),
    variations: (
      JSON.parse(problem.variations_json ?? "[]") as Array<{
        title: string;
        one_liner: string;
      }>
    ).map((v) => ({
      title: v.title,
      oneLiner: v.one_liner,
    })),
    complexity: problem.complexity ?? "Aim for linear or near-linear complexity.",
  });
}

export async function sendProblemDigest(
  env: Env,
  chatId: number,
  problem: ProblemRow,
): Promise<void> {
  const doc = parseProblemContent(problem.content_json);
  const digest = buildDigestMessage(problem);
  await sendMessage(
    env,
    chatId,
    digest,
    digestKeyboardWithNav(
      problem.id,
      doc?.slug ?? problem.slug,
      env.PAGES_URL,
      Boolean(doc),
    ),
  );
}
