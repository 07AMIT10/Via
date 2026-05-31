import { access, mkdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CurriculumRow, ProblemRecord } from "./types.js";

const execFileAsync = promisify(execFile);

const EXERCISM_REPO = "https://github.com/exercism/problem-specifications.git";

async function ensureExercismRepo(basePath: string): Promise<string | null> {
  const repoPath = resolve(basePath, ".cache", "problem-specifications");
  await mkdir(resolve(basePath, ".cache"), { recursive: true });

  try {
    await access(resolve(repoPath, ".git"), constants.F_OK);
    await execFileAsync("git", ["-C", repoPath, "pull", "--ff-only"]);
    return repoPath;
  } catch {
    try {
      await execFileAsync("git", ["clone", "--depth=1", EXERCISM_REPO, repoPath]);
      return repoPath;
    } catch {
      return null;
    }
  }
}

function stripMarkdown(md: string): string {
  return md
    .replaceAll(/```[\s\S]*?```/g, "")
    .replaceAll(/`([^`]+)`/g, "$1")
    .replaceAll(/#+\s?/g, "")
    .replaceAll(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replaceAll(/\n{2,}/g, "\n\n")
    .trim();
}

function slugFromSource(source: string): string {
  return source.replace("exercism:", "");
}

export async function exercismProblemFromCurriculum(
  row: CurriculumRow,
  basePath: string,
): Promise<ProblemRecord | null> {
  if (!row.source.startsWith("exercism:")) {
    return null;
  }

  const repoPath = await ensureExercismRepo(basePath);
  if (!repoPath) {
    return null;
  }

  const slug = slugFromSource(row.source);
  const descriptionPath = resolve(repoPath, "exercises", slug, "description.md");
  const canonicalPath = resolve(repoPath, "exercises", slug, "canonical-data.json");

  try {
    const [descriptionRaw, canonicalRaw] = await Promise.all([
      readFile(descriptionPath, "utf-8"),
      readFile(canonicalPath, "utf-8"),
    ]);

    const canonical = JSON.parse(canonicalRaw) as {
      comments?: Record<string, unknown>;
      cases?: Array<{
        description?: string;
        input?: Record<string, unknown>;
        expected?: unknown;
      }>;
    };
    const cases = canonical.cases ?? [];
    const firstCase = cases[0];

    return {
      id: row.day,
      slug,
      day_number: row.day,
      title: slug
        .split("-")
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(" "),
      description: stripMarkdown(descriptionRaw).slice(0, 4000),
      difficulty: row.difficulty,
      pattern: row.pattern,
      topic: row.topic,
      examples_json: JSON.stringify([
        {
          input: JSON.stringify(firstCase?.input ?? {}),
          output: JSON.stringify(firstCase?.expected ?? null),
          explanation: firstCase?.description ?? "Example from canonical data.",
        },
      ]),
      key_insight: "Identify the pattern and maintain an invariant through each step.",
      applications_json: JSON.stringify([
        "Interview question families",
        "Production data processing",
        "Algorithmic reasoning practice",
      ]),
      variations_json: JSON.stringify([
        { title: "Constraint-heavy variant", one_liner: "Solve with stricter time or memory bounds." },
      ]),
      why_it_matters: "This reinforces reusable thinking patterns that transfer to harder variants.",
      canonical_approach: "Start from the simplest correct approach, then optimize by eliminating repeated work and using the right data structure.",
      canonical_solutions_json: JSON.stringify({
        python: "def solve(data):\n    # TODO\n    return data\n",
        go: "package main\n\nfunc Solve(data []int) []int {\n\t// TODO\n\treturn data\n}\n",
        rust: "fn solve(data: Vec<i32>) -> Vec<i32> {\n    // TODO\n    data\n}\n",
      }),
      hints_json: JSON.stringify([
        "What invariant can you keep true as you iterate?",
        "Can a map/set/stack/queue help remove nested loops?",
        "Can you derive the next state from previous state in O(1)?",
      ]),
      complexity: "Target linear or near-linear runtime when possible.",
      test_cases_json: JSON.stringify({
        python: [{ stdin: "", expected_stdout: "" }],
        go: [{ stdin: "", expected_stdout: "" }],
        rust: [{ stdin: "", expected_stdout: "" }],
      }),
      license: "MIT",
      source_url: `${EXERCISM_REPO.replace(".git", "")}/tree/main/exercises/${slug}`,
    };
  } catch {
    return null;
  }
}
