import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  validateProblemContent,
  type ProblemContent,
} from "dsa-bot-content-schema";

export interface CurriculumRow {
  day: number;
  slug: string;
  topic?: string;
  pattern?: string;
  difficulty?: string;
  source?: string;
}

function slugFromRow(row: CurriculumRow): string {
  if (row.slug) {
    return row.slug;
  }
  if (row.source?.startsWith("classic:")) {
    return row.source.replace("classic:", "");
  }
  if (row.source?.startsWith("exercism:")) {
    return row.source.replace("exercism:", "");
  }
  throw new Error(`Curriculum day ${row.day} missing slug`);
}

export async function loadAllProblems(repoRoot: string): Promise<ProblemContent[]> {
  const dir = resolve(repoRoot, "content", "problems");
  const files = (await readdir(dir)).filter(
    (f) =>
      f.endsWith(".json") &&
      f !== "curriculum.json" &&
      !f.startsWith("_"),
  );
  const docs: ProblemContent[] = [];

  for (const file of files) {
    const raw = await readFile(resolve(dir, file), "utf-8");
    const doc = validateProblemContent(JSON.parse(raw));
    const expectedSlug = file.replace(/\.json$/, "");
    if (doc.slug !== expectedSlug) {
      throw new Error(`slug/file mismatch: ${doc.slug} vs ${file}`);
    }
    docs.push(doc);
  }

  return docs;
}

export async function loadCurriculum(repoRoot: string): Promise<CurriculumRow[]> {
  const raw = await readFile(
    resolve(repoRoot, "content", "problems", "curriculum.json"),
    "utf-8",
  );
  return JSON.parse(raw) as CurriculumRow[];
}

export async function validateCurriculum(
  repoRoot: string,
  docs: ProblemContent[],
): Promise<void> {
  const rows = await loadCurriculum(repoRoot);
  const byDay = new Map(rows.map((r) => [r.day, r]));

  for (const doc of docs) {
    const row = byDay.get(doc.meta.day);
    if (!row) {
      throw new Error(`No curriculum row for day ${doc.meta.day} (${doc.slug})`);
    }
    if (row.slug && row.slug !== doc.slug) {
      throw new Error(
        `Day ${doc.meta.day} curriculum slug ${row.slug} does not match ${doc.slug}`,
      );
    }
  }
}

export async function validateContentRepo(repoRoot: string): Promise<ProblemContent[]> {
  const docs = await loadAllProblems(repoRoot);
  await validateCurriculum(repoRoot, docs);
  return docs;
}
