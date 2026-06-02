import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { emitSeedSql } from "./content-emit.js";
import { validateContentRepo } from "./content-validate.js";
import { classicProblemFromCurriculum } from "./classics.js";
import { emitSeedSql as emitLegacySeedSql } from "./emit-sql.js";
import { enrichProblem } from "./enrich.js";
import { exercismProblemFromCurriculum } from "./exercism.js";
import { readFile } from "node:fs/promises";
import type { CurriculumRow } from "./types.js";
import { validateProblem } from "./validate.js";

async function runLegacyPipeline(repoRoot: string, outPath: string): Promise<void> {
  const curriculumPath = resolve(repoRoot, "content", "problems", "curriculum.json");
  const raw = await readFile(curriculumPath, "utf-8");
  const rows = JSON.parse(raw) as CurriculumRow[];

  const records = [];
  for (const row of rows) {
    let base = null;
    if (row.source?.startsWith("exercism:")) {
      base = await exercismProblemFromCurriculum(row, process.cwd());
    }
    if (!base) {
      base = classicProblemFromCurriculum(row);
    }
    const validated = validateProblem(base);
    const enriched = validateProblem(await enrichProblem(validated));
    records.push(enriched);
  }
  const sql = emitLegacySeedSql(records);
  await writeFile(outPath, sql, "utf-8");
  console.log(`Generated ${records.length} legacy records into ${outPath}`);
}

async function runContentPipeline(repoRoot: string, outPath: string): Promise<void> {
  const docs = await validateContentRepo(repoRoot);
  const sql = emitSeedSql(docs);
  await writeFile(outPath, sql, "utf-8");
  console.log(`Generated ${docs.length} content records into ${outPath}`);
}

async function main(): Promise<void> {
  const repoRoot = resolve(process.cwd(), "..");
  const outPath = resolve(process.cwd(), "seed.sql");
  const useLegacy = process.env.INGEST_LEGACY === "1";

  if (useLegacy) {
    await runLegacyPipeline(repoRoot, outPath);
    return;
  }

  await runContentPipeline(repoRoot, outPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
