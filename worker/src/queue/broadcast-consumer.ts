import type { MessageBatch } from "@cloudflare/workers-types";
import type { Env } from "../env";
import { digestKeyboard, renderDigest } from "../telegram/digest";
import { sendMessage } from "../telegram/send";
import { getProblemByDay } from "../db/repo";

interface BroadcastMessage {
  chatId: number;
  telegramId: number;
  day: number;
}

export async function handleBroadcastQueue(
  env: Env,
  batch: MessageBatch<BroadcastMessage>,
): Promise<void> {
  for (const message of batch.messages) {
    const payload = message.body;
    const problem = await getProblemByDay(env, payload.day);
    if (!problem) {
      message.ack();
      continue;
    }

    const digest = renderDigest({
      day: problem.day_number,
      pattern: problem.pattern,
      difficulty: problem.difficulty,
      title: problem.title,
      description: problem.description,
      keyInsight: problem.key_insight ?? "Identify the invariant that lets you avoid repeated work.",
      whyItMatters: problem.why_it_matters ?? "This pattern is common in coding interviews and high-throughput services.",
      applications: JSON.parse(problem.applications_json ?? "[]"),
      variations: (JSON.parse(problem.variations_json ?? "[]") as Array<{ title: string; one_liner: string }>).map((v) => ({
        title: v.title,
        oneLiner: v.one_liner,
      })),
      complexity: problem.complexity ?? "Aim for linear or near-linear time.",
    });

    await sendMessage(env, payload.chatId, digest, digestKeyboard(problem.id, env.PAGES_URL));
    await env.DB.prepare(
      `INSERT OR REPLACE INTO user_progress (telegram_id, problem_id, status)
       VALUES (?1, ?2, 'delivered')`,
    )
      .bind(payload.telegramId, problem.id)
      .run();
    message.ack();
  }
}
