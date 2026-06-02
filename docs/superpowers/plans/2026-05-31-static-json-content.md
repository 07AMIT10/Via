# Static JSON Content System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store rich DSA problems as versioned JSON in `content/problems/`, validate and emit to D1, and serve Telegram slices (digest, progressive approaches, quiz, debug) from `content_json` in the Worker.

**Architecture:** JSON is source of truth in git; `ingest` becomes `content:validate` + `content:emit` producing D1 rows with `content_json` plus denormalized columns. Worker adds `src/content/` projection helpers and extends callbacks (`ap`, `dr`, `q`, `qa`, `db`, `df`, `lo`, `sc`) with slug-based routing and `approach_index` progress.

**Tech Stack:** TypeScript, Zod, Cloudflare Worker, D1, Vitest, existing Telegram HTML messages.

**Design spec:** `docs/superpowers/specs/2026-05-31-static-json-content-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `content/schema/problem.v1.ts` | Zod schema + exported `ProblemContent` type |
| `content/problems/contains-duplicate.json` | Reference problem (authoring template) |
| `content/curriculum.json` | Update day 1 slug to `contains-duplicate` when ready |
| `ingest/src/content-validate.ts` | Load all JSON files, validate, cross-check curriculum |
| `ingest/src/content-emit.ts` | SQL emit from `ProblemContent[]` |
| `ingest/src/index.ts` | Call content pipeline only (deprecate classics path behind flag) |
| `worker/src/db/schema.sql` | Add `content_json`, `approach_index` migration snippet |
| `worker/src/content/types.ts` | Re-export or duplicate minimal types for worker |
| `worker/src/content/parse.ts` | `parseProblemContent` |
| `worker/src/content/projections.ts` | digest, approach, quiz, debug messages |
| `worker/src/content/telegram.ts` | length split helper |
| `worker/src/db/repo.ts` | Select `slug`, `content_json`; helpers by slug |
| `worker/src/telegram/digest.ts` | Accept richer model or call projections |
| `worker/src/telegram/callbacks.ts` | New callback actions |
| `worker/src/telegram/keyboards.ts` | Digest + approach keyboards (extract from digest.ts) |
| `worker/test/content.test.ts` | Projection unit tests |
| `worker/test/fixtures/contains-duplicate.min.json` | Small fixture for tests |

---

### Task 1: Problem v1 schema (Zod)

**Files:**
- Create: `content/schema/problem.v1.ts`
- Create: `content/problems/.gitkeep` (if needed)

- [ ] **Step 1: Add Zod schema**

```typescript
// content/schema/problem.v1.ts
import { z } from "zod";

export const approachSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  summary: z.string().min(1),
  intuition: z.string().min(1),
  algorithm_steps: z.array(z.string()).min(1),
  complexity: z.object({
    time: z.object({ notation: z.string() }),
    space: z.object({ notation: z.string() }),
  }),
  implementations: z.object({
    python: z.string(),
    go: z.string(),
    rust: z.string(),
  }),
  dry_run: z.unknown().optional(),
  trade_offs: z.unknown().optional(),
  visuals: z.object({ ascii_frames: z.array(z.string()) }).optional(),
});

export const problemContentSchema = z.object({
  schemaVersion: z.literal(1),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  canonicalApproachId: z.string().min(1),
  license: z.string().min(1),
  source: z.object({ name: z.string(), url: z.string().url() }),
  meta: z.object({
    title: z.string(),
    topic: z.string(),
    pattern: z.string(),
    difficulty: z.enum(["easy", "medium", "hard"]),
    day: z.number().int().positive(),
  }),
  statement: z.object({
    description: z.string(),
    constraints: z.array(z.string()),
    examples: z.array(
      z.object({
        input: z.string(),
        output: z.string(),
        explanation: z.string(),
      }),
    ),
  }),
  learning: z.object({
    keyInsight: z.string(),
    whyItMatters: z.string(),
    lore: z.string().optional(),
    productionFit: z
      .object({ title: z.string(), explanation: z.string() })
      .optional(),
    scaleUp: z
      .object({ scenario: z.string(), solution: z.string() })
      .optional(),
  }),
  applications: z.array(z.string()).min(2),
  hints: z.array(z.string()).min(3),
  approaches: z.array(approachSchema).min(1),
  variations: z.array(
    z.object({ slug: z.string(), title: z.string(), oneLiner: z.string() }),
  ),
  related: z.object({
    samePattern: z.array(z.string()).default([]),
    sameTopic: z.array(z.string()).default([]),
  }),
  conceptualQuiz: z.object({
    question: z.string(),
    options: z.array(z.string()).min(2),
    correctOptionIndex: z.number().int().nonnegative(),
    explanation: z.string(),
  }),
  debuggingChallenge: z.object({
    language: z.enum(["python", "go", "rust"]),
    buggyCode: z.string(),
    bugLocation: z.string(),
    fix: z.string(),
  }),
  testCases: z.record(
    z.enum(["python", "go", "rust"]),
    z.array(z.object({ stdin: z.string(), expected_stdout: z.string() })),
  ),
  solutions: z
    .object({
      python: z.object({ stub: z.string().optional() }).optional(),
      go: z.object({ stub: z.string().optional() }).optional(),
      rust: z.object({ stub: z.string().optional() }).optional(),
    })
    .optional(),
  telegram: z.object({
    digest: z.object({
      maxApplications: z.number().int().default(3),
      maxVariations: z.number().int().default(2),
    }),
    gating: z.object({
      solutionAfter: z.literal("attempted_or_hints>=2"),
    }),
  }),
});

export type ProblemContent = z.infer<typeof problemContentSchema>;

export function validateProblemContent(data: unknown): ProblemContent {
  const doc = problemContentSchema.parse(data);
  const ids = new Set(doc.approaches.map((a) => a.id));
  if (!ids.has(doc.canonicalApproachId)) {
    throw new Error(
      `canonicalApproachId "${doc.canonicalApproachId}" not in approaches`,
    );
  }
  if (doc.slug.length > 40) {
    throw new Error(`slug too long for Telegram callbacks: ${doc.slug}`);
  }
  return doc;
}
```

- [ ] **Step 2: Wire ingest to use schema**

In `ingest/package.json` add script:
```json
"content:validate": "npm run build && node dist/content-validate.js"
```

- [ ] **Step 3: Commit**

```bash
git add content/schema/problem.v1.ts ingest/package.json
git commit -m "feat(content): add Problem v1 Zod schema"
```

---

### Task 2: Add reference problem JSON

**Files:**
- Create: `content/problems/contains-duplicate.json`

- [ ] **Step 1: Copy user-authored JSON**

Paste the full `contains-duplicate` document from design discussion. Add top-level fields:

```json
{
  "schemaVersion": 1,
  "canonicalApproachId": "hash_set",
  "license": "self-written",
  "source": { "name": "original", "url": "https://example.local/problems/contains-duplicate" },
  "applications": [
    "Hash joins and GroupBy aggregates in SQL query engines",
    "Stream deduplication in event pipelines",
    "In-memory duplicate detection before writes"
  ],
  "testCases": {
    "python": [{ "stdin": "", "expected_stdout": "" }],
    "go": [{ "stdin": "", "expected_stdout": "" }],
    "rust": [{ "stdin": "", "expected_stdout": "" }]
  }
}
```

Ensure `meta.day` matches curriculum entry.

- [ ] **Step 2: Validate locally**

```bash
cd ingest && npm run build && node -e "
import { readFile } from 'node:fs/promises';
import { validateProblemContent } from './dist/content-validate.js';
"
```

(Implement `content-validate.ts` in Task 3 first if running in order.)

- [ ] **Step 3: Commit**

```bash
git add content/problems/contains-duplicate.json
git commit -m "content: add contains-duplicate reference problem"
```

---

### Task 3: Content validate + emit pipeline

**Files:**
- Create: `ingest/src/content-validate.ts`
- Create: `ingest/src/content-emit.ts`
- Modify: `ingest/src/index.ts`
- Modify: `ingest/tsconfig.json` (include schema path or copy types)

- [ ] **Step 1: `content-validate.ts`**

```typescript
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateProblemContent, type ProblemContent } from "../../content/schema/problem.v1.js";

export async function loadAllProblems(root: string): Promise<ProblemContent[]> {
  const dir = resolve(root, "content", "problems");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const docs: ProblemContent[] = [];
  for (const file of files) {
    const raw = await readFile(resolve(dir, file), "utf-8");
    const doc = validateProblemContent(JSON.parse(raw));
    if (doc.slug !== file.replace(/\.json$/, "")) {
      throw new Error(`slug/file mismatch: ${doc.slug} vs ${file}`);
    }
    docs.push(doc);
  }
  return docs;
}

export async function validateCurriculum(
  root: string,
  docs: ProblemContent[],
): Promise<void> {
  const curriculum = JSON.parse(
    await readFile(resolve(root, "content", "problems", "curriculum.json"), "utf-8"),
  ) as Array<{ day: number; slug: string; topic?: string; pattern?: string; difficulty?: string }>;
  const bySlug = new Map(docs.map((d) => [d.slug, d]));
  for (const row of curriculum) {
    const slug = row.slug ?? (row as { source?: string }).source?.replace(/^classic:/, "");
    const key = typeof row.slug === "string" ? row.slug : row.source?.split(":")[1];
    // Align with actual curriculum.json shape: add slug field to curriculum in Task 4
  }
}
```

**Note:** Update `content/problems/curriculum.json` to `{ "day": 1, "slug": "contains-duplicate" }` format (Task 4).

- [ ] **Step 2: `content-emit.ts`**

Emit SQL without transactions:

```typescript
export function emitProblemRow(doc: ProblemContent, id: number): string {
  const canonical = doc.approaches.find((a) => a.id === doc.canonicalApproachId)!;
  const solutions = {
    python: canonical.implementations.python,
    go: canonical.implementations.go,
    rust: canonical.implementations.rust,
  };
  const contentJson = JSON.stringify(doc).replace(/'/g, "''");
  return `INSERT OR REPLACE INTO problems (
    id, slug, day_number, title, description, difficulty, pattern, topic,
    examples_json, key_insight, applications_json, variations_json, why_it_matters,
    canonical_approach, canonical_solutions_json, hints_json, complexity,
    test_cases_json, license, source_url, content_json
  ) VALUES (
    ${id}, '${esc(doc.slug)}', ${doc.meta.day}, '${esc(doc.meta.title)}', '${esc(doc.statement.description)}',
    '${doc.meta.difficulty}', '${esc(doc.meta.pattern)}', '${esc(doc.meta.topic)}',
    '${esc(JSON.stringify(doc.statement.examples))}',
    '${esc(doc.learning.keyInsight)}',
    '${esc(JSON.stringify(doc.applications))}',
    '${esc(JSON.stringify(doc.variations))}',
    '${esc(doc.learning.whyItMatters)}',
    '${esc(canonical.summary)}',
    '${esc(JSON.stringify(solutions))}',
    '${esc(JSON.stringify(doc.hints))}',
    '${esc(canonical.complexity.time.notation)}',
    '${esc(JSON.stringify(doc.testCases))}',
    '${esc(doc.license)}',
    '${esc(doc.source.url)}',
    '${contentJson}'
  );`;
}
```

- [ ] **Step 3: Replace `ingest/src/index.ts` main**

```typescript
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { loadAllProblems } from "./content-validate.js";
import { emitSeedSql } from "./content-emit.js";

async function main() {
  const root = resolve(process.cwd(), "..");
  const docs = await loadAllProblems(root);
  docs.sort((a, b) => a.meta.day - b.meta.day);
  const sql = emitSeedSql(docs);
  await writeFile(resolve(process.cwd(), "seed.sql"), sql, "utf-8");
  console.log(`Generated ${docs.length} problems`);
}
```

Keep legacy pipeline behind `INGEST_LEGACY=1` env if needed for transition.

- [ ] **Step 4: Run validate + emit**

```bash
cd ingest && npm run build && node dist/index.js
cd ../worker && npx wrangler d1 execute dsa-bot --remote --file=../ingest/seed.sql --yes
```

- [ ] **Step 5: Commit**

```bash
git add ingest/src/content-validate.ts ingest/src/content-emit.ts ingest/src/index.ts
git commit -m "feat(ingest): JSON content validate and emit pipeline"
```

---

### Task 4: D1 schema migration

**Files:**
- Modify: `worker/src/db/schema.sql`
- Create: `worker/migrations/0002_content_json.sql` (optional separate file)

- [ ] **Step 1: Add columns**

```sql
ALTER TABLE problems ADD COLUMN content_json TEXT;
ALTER TABLE user_progress ADD COLUMN approach_index INTEGER NOT NULL DEFAULT 0;
```

For fresh installs, add `content_json TEXT NOT NULL DEFAULT '{}'` to `CREATE TABLE problems`.

- [ ] **Step 2: Apply remote**

```bash
cd worker && npx wrangler d1 execute dsa-bot --remote --file=migrations/0002_content_json.sql --yes
```

- [ ] **Step 3: Commit**

```bash
git add worker/src/db/schema.sql worker/migrations/0002_content_json.sql
git commit -m "feat(db): add content_json and approach_index columns"
```

---

### Task 5: Worker content projections + tests

**Files:**
- Create: `worker/src/content/parse.ts`
- Create: `worker/src/content/projections.ts`
- Create: `worker/src/content/telegram.ts`
- Create: `worker/test/content.test.ts`
- Create: `worker/test/fixtures/contains-duplicate.min.json`

- [ ] **Step 1: Write failing tests**

```typescript
// worker/test/content.test.ts
import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { projectDigest, projectApproach } from "../src/content/projections";
import { parseProblemContent } from "../src/content/parse";

describe("content projections", () => {
  it("builds digest under 4000 chars", async () => {
    const raw = await readFile(
      new URL("./fixtures/contains-duplicate.min.json", import.meta.url),
      "utf-8",
    );
    const doc = parseProblemContent(raw);
    const { html, length } = projectDigest(doc);
    expect(length).toBeLessThan(4000);
    expect(html).toContain("Contains Duplicate");
  });

  it("projects approach by index", async () => {
    const raw = await readFile(
      new URL("./fixtures/contains-duplicate.min.json", import.meta.url),
      "utf-8",
    );
    const doc = parseProblemContent(raw);
    const msg = projectApproach(doc, 0);
    expect(msg.html).toContain("Brute Force");
  });
});
```

- [ ] **Step 2: Implement parse + projections**

`parseProblemContent` uses same Zod schema (import from `content/schema/problem.v1.ts` via relative path or duplicate minimal validator in worker to avoid bundling issues — prefer **shared package** `content/schema` imported by both worker and ingest with `noEmit` types only, or copy schema file into worker).

`projectApproach(doc, index)` returns `{ html, hasNext, nextIndex }`.

`projectDigest` maps `applications`, `variations`, canonical complexity.

- [ ] **Step 3: Run tests**

```bash
cd worker && npm test
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add worker/src/content worker/test/content.test.ts worker/test/fixtures
git commit -m "feat(worker): content parse and Telegram projections"
```

---

### Task 6: Repo layer + commands use content_json

**Files:**
- Modify: `worker/src/db/repo.ts`
- Modify: `worker/src/telegram/commands.ts`
- Modify: `worker/src/queue/broadcast-consumer.ts`

- [ ] **Step 1: Extend `ProblemRow`**

```typescript
export interface ProblemRow {
  // existing fields...
  slug: string;
  content_json: string | null;
}
```

Update SELECT lists to include `slug, content_json`.

Add:

```typescript
export function getProblemContent(row: ProblemRow): ProblemContent | null {
  if (!row.content_json) return null;
  return parseProblemContent(row.content_json);
}
```

- [ ] **Step 2: Update `/today` in commands.ts**

If `getProblemContent(problem)` returns doc, use `projectDigest(doc)`; else legacy `renderDigest`.

- [ ] **Step 3: Update broadcast consumer similarly**

- [ ] **Step 4: Commit**

```bash
git add worker/src/db/repo.ts worker/src/telegram/commands.ts worker/src/queue/broadcast-consumer.ts
git commit -m "feat(telegram): serve digest from content_json when present"
```

---

### Task 7: Progressive approach callbacks

**Files:**
- Create: `worker/src/telegram/keyboards.ts`
- Modify: `worker/src/telegram/callbacks.ts`
- Modify: `worker/src/telegram/digest.ts`

- [ ] **Step 1: Slug-based callback parser**

```typescript
// ap:contains-duplicate:0
function parseSlugCallback(data: string): { action: string; slug: string; index?: number } | null {
  const [action, slug, idx] = data.split(":");
  if (!action || !slug) return null;
  return { action, slug, index: idx !== undefined ? Number(idx) : undefined };
}
```

Support both legacy numeric `h:1:1` and slug `h:contains-duplicate:1` during transition (map id→slug in repo).

- [ ] **Step 2: Implement `ap` handler**

Load problem by slug, `projectApproach(doc, index)`, send message, keyboard:

```typescript
[
  [{ text: "Next approach", callback_data: `ap:${slug}:${index + 1}` }],
  [{ text: "Dry run", callback_data: `dr:${slug}:${index}` }],
]
```

Hide Next on last index.

Update `approach_index` and `approach_shown = 1`.

- [ ] **Step 3: Implement `dr`, `q`, `qa`, `db`, `df`, `lo`, `sc`**

Per design spec section 5.

- [ ] **Step 4: Update digest keyboard**

Add Approach 1, Quiz, Debug, Lore buttons; keep existing Hint/Solve/Skip.

- [ ] **Step 5: Manual Telegram test**

`/today` → Approach 1 → Next approach → Quiz answer.

- [ ] **Step 6: Commit**

```bash
git add worker/src/telegram/
git commit -m "feat(telegram): progressive approaches and rich content callbacks"
```

---

### Task 8: Curriculum + deprecate legacy ingest

**Files:**
- Modify: `content/problems/curriculum.json`
- Modify: `ingest/src/index.ts`
- Modify: `README.md`, `SETUP.md`

- [ ] **Step 1: Add slug to curriculum rows**

```json
{ "day": 1, "slug": "contains-duplicate", "topic": "arrays", "pattern": "hashing", "difficulty": "easy" }
```

Remove `source: classic:...` for migrated days or keep as doc only.

- [ ] **Step 2: Document content authoring in README**

Short section: add JSON under `content/problems/`, run `cd ingest && npm run build && node dist/index.js`, apply seed.

- [ ] **Step 3: Commit**

```bash
git add content/problems/curriculum.json README.md SETUP.md
git commit -m "docs: JSON content authoring workflow"
```

---

### Task 9: Mini App API reads statement from JSON

**Files:**
- Modify: `worker/src/api/problem.ts`

- [ ] **Step 1: When `content_json` present, return structured statement**

```typescript
const doc = getProblemContent(row);
if (doc) {
  return Response.json({
    title: doc.meta.title,
    description: doc.statement.description,
    constraints: doc.statement.constraints,
    examples: doc.statement.examples,
    keyInsight: doc.learning.keyInsight,
    // ...
  });
}
```

- [ ] **Step 2: Stub code from solutions or canonical implementation**

- [ ] **Step 3: Commit + deploy**

```bash
cd worker && npm test && npx wrangler deploy
```

---

## Plan self-review

| Spec requirement | Task |
|------------------|------|
| JSON source of truth | 1–3 |
| schemaVersion, canonicalApproachId, testCases, applications | 1–2 |
| Progressive approaches B | 7 |
| Quiz, debug, lore, scale | 7 |
| D1 content_json + approach_index | 4 |
| Drop Groq/Exercism default path | 3, 8 |
| Mini App statement | 9 |
| Telegram 4k limit | 5 |
| Slug callbacks ≤64 bytes | 1 validates slug length |

No TBD placeholders in task steps above.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-31-static-json-content.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — implement tasks in this session with checkpoints  

Which approach do you want?
