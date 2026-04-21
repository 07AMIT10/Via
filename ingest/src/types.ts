export type Difficulty = "easy" | "medium" | "hard";

export interface CurriculumRow {
  day: number;
  topic: string;
  pattern: string;
  difficulty: Difficulty;
  source: string;
}

export interface ProblemRecord {
  id: number;
  slug: string;
  day_number: number;
  title: string;
  description: string;
  difficulty: Difficulty;
  pattern: string;
  topic: string;
  examples_json: string;
  key_insight: string;
  applications_json: string;
  variations_json: string;
  why_it_matters: string;
  canonical_approach: string;
  canonical_solutions_json: string;
  hints_json: string;
  complexity: string;
  test_cases_json: string;
  license: string;
  source_url: string;
}
