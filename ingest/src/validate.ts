import { z } from "zod";
import type { ProblemRecord } from "./types";

const problemSchema = z.object({
  id: z.number().int().positive(),
  slug: z.string().min(1),
  day_number: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
  difficulty: z.enum(["easy", "medium", "hard"]),
  pattern: z.string().min(1),
  topic: z.string().min(1),
  examples_json: z.string(),
  key_insight: z.string().min(1),
  applications_json: z.string(),
  variations_json: z.string(),
  why_it_matters: z.string().min(1),
  canonical_approach: z.string().min(1),
  canonical_solutions_json: z.string(),
  hints_json: z.string(),
  complexity: z.string().min(1),
  test_cases_json: z.string(),
  license: z.string().min(1),
  source_url: z.string().min(1),
});

export function validateProblem(record: ProblemRecord): ProblemRecord {
  const parsed = problemSchema.parse(record);
  const hints = JSON.parse(parsed.hints_json) as unknown[];
  const examples = JSON.parse(parsed.examples_json) as unknown[];
  const apps = JSON.parse(parsed.applications_json) as unknown[];
  const vars = JSON.parse(parsed.variations_json) as unknown[];
  const solutions = JSON.parse(parsed.canonical_solutions_json) as Record<string, unknown>;
  const tests = JSON.parse(parsed.test_cases_json) as Record<string, unknown>;

  if (hints.length < 3) {
    throw new Error(`Problem ${parsed.slug} must contain at least 3 hints`);
  }
  if (examples.length < 1) {
    throw new Error(`Problem ${parsed.slug} must contain at least 1 example`);
  }
  if (apps.length < 2) {
    throw new Error(`Problem ${parsed.slug} must contain at least 2 applications`);
  }
  if (vars.length < 1) {
    throw new Error(`Problem ${parsed.slug} must contain at least 1 variation`);
  }
  for (const lang of ["python", "go", "rust"]) {
    if (typeof solutions[lang] !== "string") {
      throw new Error(`Problem ${parsed.slug} missing canonical solution for ${lang}`);
    }
    if (!Array.isArray((tests as Record<string, unknown>)[lang])) {
      throw new Error(`Problem ${parsed.slug} missing test array for ${lang}`);
    }
  }

  return parsed;
}
