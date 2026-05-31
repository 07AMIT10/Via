import type { ProblemContent } from "dsa-bot-content-schema";
import { canonicalApproach } from "./parse.js";
import { escHtml } from "./html.js";
import { truncateTelegramHtml } from "./telegram.js";

export interface DigestProjection {
  html: string;
  length: number;
}

export interface ApproachProjection {
  html: string;
  index: number;
  hasNext: boolean;
  isCanonical: boolean;
}

export function projectDigest(doc: ProblemContent): DigestProjection {
  const maxApps = doc.telegram.digest.maxApplications;
  const maxVars = doc.telegram.digest.maxVariations;
  const canonical = canonicalApproach(doc);

  const apps = doc.applications
    .slice(0, maxApps)
    .map((a) => `• ${escHtml(a)}`)
    .join("\n");
  const vars = doc.variations
    .slice(0, maxVars)
    .map((v) => `• <i>${escHtml(v.title)}</i> — ${escHtml(v.oneLiner)}`)
    .join("\n");

  const html = truncateTelegramHtml(`<b>Day ${doc.meta.day} · ${escHtml(doc.meta.pattern)} · ${escHtml(doc.meta.difficulty)}</b>

<b>${escHtml(doc.meta.title)}</b>
${escHtml(doc.statement.description)}

<b>Key insight</b>
${escHtml(doc.learning.keyInsight)}

<b>Why it matters</b>
${escHtml(doc.learning.whyItMatters)}

<b>Where you'll see this</b>
${apps}

<b>Variations</b>
${vars}

<b>Complexity target</b>
<code>${escHtml(canonical.complexity.time.notation)}</code>`);

  return { html, length: html.length };
}

export function projectApproach(doc: ProblemContent, index: number): ApproachProjection {
  const approach = doc.approaches[index];
  if (!approach) {
    throw new Error(`approach index ${index} out of range`);
  }

  const frame = approach.visuals?.ascii_frames?.[0];
  const frameBlock = frame ? `\n<pre>${escHtml(frame.replace(/```/g, ""))}</pre>` : "";

  const html = truncateTelegramHtml(`<b>${escHtml(approach.label)}</b>
${escHtml(approach.summary)}

${escHtml(approach.intuition)}
${frameBlock}

<b>Time</b> <code>${escHtml(approach.complexity.time.notation)}</code>
<b>Space</b> <code>${escHtml(approach.complexity.space.notation)}</code>`);

  return {
    html,
    index,
    hasNext: index + 1 < doc.approaches.length,
    isCanonical: approach.id === doc.canonicalApproachId,
  };
}

export function projectQuiz(doc: ProblemContent): { html: string; options: string[] } {
  const q = doc.conceptualQuiz;
  const options = q.options
    .map((opt, i) => `${i + 1}. ${escHtml(opt)}`)
    .join("\n");
  return {
    html: truncateTelegramHtml(`<b>Quick check</b>\n${escHtml(q.question)}\n\n${options}`),
    options: q.options,
  };
}

export function projectDebug(doc: ProblemContent): string {
  const d = doc.debuggingChallenge;
  return truncateTelegramHtml(
    `<b>Debug challenge</b> (${d.language})\n<pre>${escHtml(d.buggyCode)}</pre>\n<i>${escHtml(d.bugLocation)}</i>`,
  );
}

export function projectDebugFix(doc: ProblemContent): string {
  return truncateTelegramHtml(`<b>Fix</b>\n${escHtml(doc.debuggingChallenge.fix)}`);
}

export function projectLore(doc: ProblemContent): string {
  const lore = doc.learning.lore ?? "No lore for this problem yet.";
  return truncateTelegramHtml(`<b>Lore</b>\n${escHtml(lore)}`);
}

export function projectScaleUp(doc: ProblemContent): string {
  const s = doc.learning.scaleUp;
  if (!s) {
    return "<b>Scale-up</b>\nNo scale-up scenario for this problem yet.";
  }
  return truncateTelegramHtml(
    `<b>Scale-up</b>\n${escHtml(s.scenario)}\n\n${escHtml(s.solution)}`,
  );
}

export function projectQuizAnswer(doc: ProblemContent, optionIndex: number): string {
  const q = doc.conceptualQuiz;
  const correct = optionIndex === q.correctOptionIndex;
  const prefix = correct ? "Correct." : "Not quite.";
  return truncateTelegramHtml(`${prefix}\n${escHtml(q.explanation)}`);
}

export function solutionCode(
  doc: ProblemContent,
  lang: "python" | "go" | "rust",
): string {
  return canonicalApproach(doc).implementations[lang];
}

interface DryRunPayload {
  input?: string;
  steps?: string[];
}

export function projectDryRun(doc: ProblemContent, index: number): string | null {
  const approach = doc.approaches[index];
  if (!approach) {
    return null;
  }
  const dryRun = approach.dry_run as DryRunPayload | undefined;
  if (!dryRun?.steps?.length) {
    return null;
  }
  const steps = dryRun.steps.map((step) => escHtml(step)).join("\n");
  const inputLine = dryRun.input ? `\n<code>${escHtml(dryRun.input)}</code>\n` : "\n";
  return truncateTelegramHtml(
    `<b>Dry run — ${escHtml(approach.label)}</b>${inputLine}${steps}`,
  );
}
