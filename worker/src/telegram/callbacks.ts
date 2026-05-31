import type { Env } from "../env";
import { parseProblemContent } from "../content/parse.js";
import {
  projectApproach,
  projectDebug,
  projectDebugFix,
  projectDryRun,
  projectLore,
  projectQuiz,
  projectQuizAnswer,
  projectScaleUp,
  solutionCode,
} from "../content/projections.js";
import { parseProblemRef, resolveProblem } from "../db/problem-resolve.js";
import { getPreferredLanguage } from "../db/repo";
import { answerCallbackQuery, sendMessage } from "./send";
import {
  approachKeyboard,
  debugFixKeyboard,
  quizKeyboard,
} from "./keyboards.js";

function parseCallbackData(
  data: string,
): { action: string; key: string; payload?: string } | null {
  const [action, key, ...rest] = data.split(":");
  if (!action || !key) {
    return null;
  }
  return { action, key, payload: rest[0] };
}

async function recordApproachView(
  env: Env,
  telegramId: number,
  problemId: number,
  index: number,
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO user_progress (telegram_id, problem_id, status, approach_shown, approach_index)
     VALUES (?1, ?2, 'read', 1, ?3)
     ON CONFLICT(telegram_id, problem_id) DO UPDATE SET
       approach_shown = 1,
       approach_index = max(user_progress.approach_index, excluded.approach_index)`,
  )
    .bind(telegramId, problemId, index)
    .run();
}

async function canRevealSolution(
  env: Env,
  telegramId: number,
  problemId: number,
): Promise<boolean> {
  const progress = await env.DB.prepare(
    `SELECT approach_shown, approach_index, hints_used, status, last_attempt
     FROM user_progress
     WHERE telegram_id = ?1 AND problem_id = ?2`,
  )
    .bind(telegramId, problemId)
    .first<{
      approach_shown: number | null;
      approach_index: number | null;
      hints_used: number | null;
      status: string | null;
      last_attempt: number | null;
    }>();

  const hintsOk = (progress?.hints_used ?? 0) >= 2;
  const attempted =
    progress?.status === "attempted" || progress?.status === "solved";
  const approachOk = (progress?.approach_shown ?? 0) === 1;
  const waited24h =
    (progress?.last_attempt ?? 0) <
    Math.floor(Date.now() / 1000) - 24 * 60 * 60;

  return (hintsOk || attempted) && (approachOk || waited24h);
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

  const ref = parseProblemRef(parsed.key);
  const problem = await resolveProblem(env, ref);
  if (!problem) {
    await answerCallbackQuery(env, callbackQueryId, "Problem not found");
    return;
  }

  const doc = parseProblemContent(problem.content_json);
  const problemId = problem.id;
  const slug = doc?.slug ?? problem.slug;

  switch (parsed.action) {
    case "h": {
      const requestedHint = Math.min(3, Math.max(1, Number(parsed.payload ?? "1")));
      const hints = doc?.hints ?? (JSON.parse(problem.hints_json ?? "[]") as string[]);
      const hintText = hints[requestedHint - 1] ?? "No more hints available for this problem.";
      await env.DB.prepare(
        `INSERT INTO user_progress (telegram_id, problem_id, status, hints_used)
         VALUES (?1, ?2, 'read', ?3)
         ON CONFLICT(telegram_id, problem_id) DO UPDATE SET
           hints_used = max(user_progress.hints_used, excluded.hints_used)`,
      )
        .bind(telegramId, problemId, requestedHint)
        .run();
      await answerCallbackQuery(env, callbackQueryId, `Hint ${requestedHint} unlocked`);
      await sendMessage(env, chatId, `<b>Hint ${requestedHint}</b>\n${hintText}`);
      return;
    }
    case "n":
      await env.DB.prepare(
        `UPDATE user_progress
         SET hints_used = min(3, hints_used + 1)
         WHERE telegram_id = ?1 AND problem_id = ?2`,
      )
        .bind(telegramId, problemId)
        .run();
      await answerCallbackQuery(env, callbackQueryId, "Use Hint button again");
      return;
    case "r":
      await env.DB.prepare(
        `INSERT INTO user_progress (telegram_id, problem_id, status)
         VALUES (?1, ?2, 'read')
         ON CONFLICT(telegram_id, problem_id) DO UPDATE SET status = 'read'`,
      )
        .bind(telegramId, problemId)
        .run();
      await answerCallbackQuery(env, callbackQueryId, "Marked as read");
      return;
    case "a": {
      if (doc) {
        const index = 0;
        const msg = projectApproach(doc, index);
        await recordApproachView(env, telegramId, problemId, index);
        await answerCallbackQuery(env, callbackQueryId, "Approach unlocked");
        await sendMessage(
          env,
          chatId,
          msg.html,
          approachKeyboard(slug, index, msg.hasNext),
        );
        return;
      }
      const approach =
        problem.canonical_approach ??
        "Define a clear invariant, maintain it through each step, and avoid recomputing state.";
      await recordApproachView(env, telegramId, problemId, 0);
      await answerCallbackQuery(env, callbackQueryId, "Approach unlocked");
      await sendMessage(env, chatId, `<b>Canonical approach</b>\n${approach}`);
      return;
    }
    case "ap": {
      if (!doc) {
        await answerCallbackQuery(env, callbackQueryId, "Rich content unavailable");
        return;
      }
      const index = Math.max(0, Number(parsed.payload ?? "0"));
      if (index >= doc.approaches.length) {
        await answerCallbackQuery(env, callbackQueryId, "No more approaches");
        return;
      }
      const msg = projectApproach(doc, index);
      await recordApproachView(env, telegramId, problemId, index);
      const label =
        index === doc.approaches.length - 1 && msg.isCanonical
          ? "Optimal approach"
          : `Approach ${index + 1}`;
      await answerCallbackQuery(env, callbackQueryId, label);
      await sendMessage(
        env,
        chatId,
        msg.html,
        approachKeyboard(slug, index, msg.hasNext),
      );
      return;
    }
    case "dr": {
      if (!doc) {
        await answerCallbackQuery(env, callbackQueryId, "Dry run unavailable");
        return;
      }
      const index = Math.max(0, Number(parsed.payload ?? "0"));
      const dryRun = projectDryRun(doc, index);
      if (!dryRun) {
        await answerCallbackQuery(env, callbackQueryId, "No dry run for this approach");
        return;
      }
      await answerCallbackQuery(env, callbackQueryId, "Dry run");
      await sendMessage(env, chatId, dryRun);
      return;
    }
    case "q": {
      if (!doc) {
        await answerCallbackQuery(env, callbackQueryId, "Quiz unavailable");
        return;
      }
      const quiz = projectQuiz(doc);
      await answerCallbackQuery(env, callbackQueryId, "Quick check");
      await sendMessage(env, chatId, quiz.html, quizKeyboard(slug, quiz.options.length));
      return;
    }
    case "qa": {
      if (!doc) {
        await answerCallbackQuery(env, callbackQueryId, "Quiz unavailable");
        return;
      }
      const optionIndex = Number(parsed.payload ?? "0");
      const answer = projectQuizAnswer(doc, optionIndex);
      const correct = optionIndex === doc.conceptualQuiz.correctOptionIndex;
      await answerCallbackQuery(
        env,
        callbackQueryId,
        correct ? "Correct" : "Try again",
      );
      await sendMessage(env, chatId, answer);
      return;
    }
    case "db": {
      if (!doc) {
        await answerCallbackQuery(env, callbackQueryId, "Debug unavailable");
        return;
      }
      await answerCallbackQuery(env, callbackQueryId, "Debug challenge");
      await sendMessage(env, chatId, projectDebug(doc), debugFixKeyboard(slug));
      return;
    }
    case "df": {
      if (!doc) {
        await answerCallbackQuery(env, callbackQueryId, "Fix unavailable");
        return;
      }
      await answerCallbackQuery(env, callbackQueryId, "Fix");
      await sendMessage(env, chatId, projectDebugFix(doc));
      return;
    }
    case "lo": {
      if (!doc) {
        await answerCallbackQuery(env, callbackQueryId, "Lore unavailable");
        return;
      }
      await answerCallbackQuery(env, callbackQueryId, "Lore");
      await sendMessage(env, chatId, projectLore(doc));
      return;
    }
    case "sc": {
      if (!doc) {
        await answerCallbackQuery(env, callbackQueryId, "Scale-up unavailable");
        return;
      }
      await answerCallbackQuery(env, callbackQueryId, "Scale-up");
      await sendMessage(env, chatId, projectScaleUp(doc));
      return;
    }
    case "s": {
      const canReveal = await canRevealSolution(env, telegramId, problemId);
      if (!canReveal) {
        await answerCallbackQuery(
          env,
          callbackQueryId,
          "Reveal approach first or use 2 hints",
        );
        return;
      }
      const lang = await getPreferredLanguage(env, telegramId);
      const code = doc
        ? solutionCode(doc, lang)
        : (JSON.parse(problem.canonical_solutions_json ?? "{}") as Record<string, string>)[
            lang
          ] ?? "# Solution unavailable";
      await answerCallbackQuery(env, callbackQueryId, "Solution unlocked");
      await sendMessage(env, chatId, `<b>Reference solution (${lang})</b>\n<pre>${code}</pre>`);
      return;
    }
    case "m":
      await env.DB.prepare(
        `INSERT INTO user_progress (telegram_id, problem_id, status)
         VALUES (?1, ?2, 'attempted')
         ON CONFLICT(telegram_id, problem_id) DO UPDATE SET status = 'attempted'`,
      )
        .bind(telegramId, problemId)
        .run();
      await answerCallbackQuery(env, callbackQueryId, "Marked as attempted");
      return;
    case "k":
      await env.DB.prepare(
        `INSERT INTO user_progress (telegram_id, problem_id, status)
         VALUES (?1, ?2, 'skipped')
         ON CONFLICT(telegram_id, problem_id) DO UPDATE SET status = 'skipped'`,
      )
        .bind(telegramId, problemId)
        .run();
      await answerCallbackQuery(env, callbackQueryId, "Skipped for today");
      return;
    default:
      await answerCallbackQuery(env, callbackQueryId, "Unknown action");
  }
}
