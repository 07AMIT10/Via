import type { ProblemContent } from "dsa-bot-content-schema";
import { canonicalApproach, parseProblemContent } from "../content/parse.js";
import type { ProblemRow } from "../db/repo";

export interface ProblemApiPayload {
  id: number;
  slug: string;
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
  constraints?: string[];
  examples?: ProblemContent["statement"]["examples"];
  editor_stub?: string;
  test_cases?: Array<{ stdin: string; expected_stdout: string }>;
}

export function serializeProblemApi(
  row: ProblemRow,
  lang: "python" | "go" | "rust",
): ProblemApiPayload {
  const doc = parseProblemContent(row.content_json);
  if (doc) {
    const canonical = canonicalApproach(doc);
    const stub =
      doc.solutions?.[lang]?.stub ?? canonical.implementations[lang];
    return {
      id: row.id,
      slug: doc.slug,
      day_number: doc.meta.day,
      title: doc.meta.title,
      description: doc.statement.description,
      pattern: doc.meta.pattern,
      difficulty: doc.meta.difficulty,
      key_insight: doc.learning.keyInsight,
      why_it_matters: doc.learning.whyItMatters,
      applications_json: JSON.stringify(doc.applications),
      variations_json: JSON.stringify(
        doc.variations.map((v) => ({ title: v.title, one_liner: v.oneLiner })),
      ),
      complexity: canonical.complexity.time.notation,
      constraints: doc.statement.constraints,
      examples: doc.statement.examples,
      editor_stub: stub,
      test_cases: doc.testCases[lang],
    };
  }

  return {
    id: row.id,
    slug: row.slug,
    day_number: row.day_number,
    title: row.title,
    description: row.description,
    pattern: row.pattern,
    difficulty: row.difficulty,
    key_insight: row.key_insight,
    why_it_matters: row.why_it_matters,
    applications_json: row.applications_json,
    variations_json: row.variations_json,
    complexity: row.complexity,
  };
}
