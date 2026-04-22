import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { classicProblemFromCurriculum } from "./classics";
import { emitSeedSql } from "./emit-sql";
import { enrichProblem } from "./enrich";
import { exercismProblemFromCurriculum } from "./exercism";
import type { CurriculumRow } from "./types";
import { validateProblem } from "./validate";

async function main(): Promise<void> {
  const curriculumPath = resolve(process.cwd(), "..", "content", "problems", "curriculum.json");
  const outPath = resolve(process.cwd(), "seed.sql");

  const raw = await readFile(curriculumPath, "utf-8");
  const rows = JSON.parse(raw) as CurriculumRow[];

  const records = [];
  for (const row of rows) {
    let base = null;
    if (row.source.startsWith("exercism:")) {
      base = await exercismProblemFromCurriculum(row, process.cwd());
    }
    if (!base) {
      base = classicProblemFromCurriculum(row);
    }
    const validated = validateProblem(base);
    const enriched = validateProblem(await enrichProblem(validated));
    records.push(enriched);
  }
  const sql = emitSeedSql(records);
  await writeFile(outPath, sql, "utf-8");
  console.log(`Generated ${records.length} records into ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
