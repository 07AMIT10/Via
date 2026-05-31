# Static JSON Content System — Design Spec

**Date:** 2026-05-31  
**Status:** Approved  
**Goal:** Replace fragmented ingest (classics TS, Exercism, Groq) with versioned JSON problem documents as the single source of truth, while keeping D1 for per-user state only.

---

## 1. Problem statement

The bot’s learning content is deterministic: same digest, hints, and approaches for every user on a given day. Today that content is split across `ingest/src/classics.ts`, optional Exercism clones, optional Groq enrichment, and flat D1 columns. That makes it hard to author rich problems (multiple approaches, trivia, quizzes) in one place and to evolve Telegram UX without re-running pipelines.

---

## 2. Goals

- One JSON file per problem in git (reviewable, diffable, incrementally expandable).
- Telegram commands pull **slices** of JSON (digest, hints, progressive approaches, quiz, debug, lore).
- Progressive approach unlock (**option B**): one approach per step with “Next approach”.
- D1 stores user state only; problem bodies come from validated JSON at build/deploy time.
- Remove Exercism/Groq from the default deploy path (optional offline tools later).

## Non-goals (v1)

- Authoring UI or Notion sync.
- Storing full JSON in KV/R2 without deploy.
- Migrating all 30 existing problems in one PR (pilot 1–3, then batch).

---

## 3. Content layout

```
content/
  schema/
    problem.v1.ts          # Zod schema (shared types)
  curriculum.json          # [{ "day": 1, "slug": "contains-duplicate" }, ...]
  topics/
    arrays.json            # { "topic": "arrays", "slugs": ["contains-duplicate", ...] }
  problems/
    contains-duplicate.json
    two-sum.json           # migrated over time
```

### 3.1 Problem document (v1)

Required top-level fields:

| Field | Type | Purpose |
|-------|------|---------|
| `schemaVersion` | `1` | Migration guard |
| `slug` | string | Stable ID in callbacks |
| `canonicalApproachId` | string | Must match `approaches[].id` |
| `license` | string | e.g. `self-written`, `mit-exercism` |
| `source` | `{ name, url }` | Attribution |
| `meta` | object | title, topic, pattern, difficulty, day |
| `statement` | object | description, constraints, examples |
| `learning` | object | keyInsight, whyItMatters, lore, productionFit, scaleUp |
| `applications` | string[] | Digest bullets (≥2); may echo productionFit |
| `hints` | string[] | ≥3, progressive |
| `approaches` | array | Ordered naive → optimal; unlock order = array order |
| `variations` | array | slug, title, oneLiner |
| `related` | object | samePattern, sameTopic slug lists |
| `conceptualQuiz` | object | question, options, correctOptionIndex, explanation |
| `debuggingChallenge` | object | language, buggyCode, bugLocation, fix |
| `testCases` | object | per-lang arrays for Judge0 (may be stub) |
| `solutions` | object | optional stubs; reference via canonical approach |
| `telegram` | object | digest limits, gating rules |

Reference authoring example: `contains-duplicate` (user-provided sample) is the template for depth and field names.

### 3.2 Approach object

Each `approaches[]` entry includes at minimum: `id`, `label`, `summary`, `intuition`, `algorithm_steps`, `complexity` (time/space), `implementations` (python/go/rust).

Optional for v1 on non-canonical approaches: `dry_run`, `trade_offs`, `visuals.ascii_frames` (canonical should be fullest).

### 3.3 Curriculum

`curriculum.json` lists only `{ day, slug }`. `meta.day` in problem file must match curriculum row for that slug.

---

## 4. Runtime architecture

```
┌─────────────────┐     build (CI/local)      ┌──────────────────┐
│ content/*.json  │ ────────────────────────► │ seed.sql / D1    │
└─────────────────┘   validate + emit         │ problems table   │
                                              └────────┬─────────┘
                                                       │
┌──────────────┐   webhook/cron    ┌──────────────────▼─────────┐
│ Telegram     │ ◄──────────────── │ Cloudflare Worker          │
│ user         │                   │ - slice JSON from row      │
└──────────────┘                   │ - progress in D1           │
                                   └────────────────────────────┘
```

### 4.1 D1 schema changes

**`problems` table** (additive migration):

- `slug TEXT NOT NULL UNIQUE` (if not already unique via existing slug column)
- `content_json TEXT NOT NULL` — full validated problem document
- Keep denormalized columns for backward compatibility during migration: `title`, `description`, `day_number`, `topic`, `pattern`, `difficulty`, `hints_json`, etc., populated by emit step from JSON

**`user_progress` table** (additive):

- `approach_index INTEGER NOT NULL DEFAULT 0` — highest approach index unlocked/viewed
- `slug TEXT` optional cache; primary key remains `(telegram_id, problem_id)`

### 4.2 Build pipeline (`content/` package or extend `ingest/`)

1. `npm run content:validate` — load all `content/problems/*.json`, Zod parse, cross-check curriculum.
2. `npm run content:emit` — write `ingest/seed.sql` (no `BEGIN TRANSACTION`; D1-compatible).

Emit rules:

- `content_json` = stringified full document
- Denormalized fields derived for legacy code paths until worker fully uses `content_json`
- `canonical_approach` / `canonical_solutions_json` derived from `canonicalApproachId`

### 4.3 Worker content access

New module `worker/src/content/`:

- `parseProblemContent(content_json: string): ProblemContent` (typed)
- `projectDigest(doc): DigestModel`
- `projectApproach(doc, index): ApproachMessage`
- `projectQuiz(doc): QuizKeyboard`
- `truncateForTelegram(html, maxLen = 4000)`

Worker reads `content_json` via existing `getProblemByDay` / `getProblemById` after repo returns row.

---

## 5. Telegram UX

### 5.1 `/today` digest

Single HTML message:

- meta + short statement
- `learning.keyInsight`, `learning.whyItMatters`
- up to `telegram.digest.maxApplications` from `applications`
- up to `telegram.digest.maxVariations` from `variations`
- complexity from canonical approach only

### 5.2 Inline keyboard (v1)

| Button | Callback | Behavior |
|--------|----------|----------|
| Hint 1 | `h:{slug}:1` | hints[0] |
| Mark read | `r:{slug}` | status read |
| Approach 1 | `ap:{slug}:0` | approaches[0] + Next |
| Quiz | `q:{slug}` | conceptualQuiz options |
| Debug | `db:{slug}` | buggy code |
| Lore | `lo:{slug}` | learning.lore |
| Scale up | `sc:{slug}` | learning.scaleUp |
| Mark attempted | `m:{slug}` | attempted |
| Skip | `k:{slug}` | skipped |
| Show solution | `s:{slug}` | gated canonical code |
| Solve now | web_app | Mini App |

**Callback data limit:** Telegram max 64 bytes. Use short action codes; slugs must stay ≤ ~40 chars.

### 5.3 Progressive approaches (option B)

1. User taps `ap:{slug}:0` → send approach 0 (summary + trimmed intuition + ≤1 ASCII frame).
2. Keyboard: `Next approach` → `ap:{slug}:1`, optional `Dry run` → `dr:{slug}:0`.
3. Update `user_progress.approach_index = max(current, index)`.
4. On last approach, label optimal; enable solution if gating satisfied.

### 5.4 Quiz

- `q:{slug}` sends question + inline options `qa:{slug}:0`, `qa:{slug}:1`, …
- On answer: toast + explanation; optional record in progress (future).

### 5.5 Debug

- `db:{slug}` sends buggy code in `<pre>`
- `df:{slug}` sends fix text

### 5.6 Solution gating

From `telegram.gating.solutionAfter`:

- `attempted_or_hints>=2` — existing semantics: `hints_used >= 2` OR status `attempted`/`solved`, AND (`approach_shown` OR 24h since last_attempt) for solution button (keep or relax to `approach_index >= 0` after first approach view).

---

## 6. Mini App

- `GET /api/today` and `GET /api/problem/:id` return `statement` + meta from `content_json` when present; fall back to denormalized columns.
- Editor stub from `solutions[lang].stub` or canonical `implementations[lang]`.
- Deep link continues `?problem={id}`; optional later `?slug=`.

---

## 7. Migration strategy

| Phase | Work |
|-------|------|
| 1 | Schema + Zod + emit; pilot `contains-duplicate.json` |
| 2 | Worker projections + callbacks `ap`, `dr`, `q`, `qa`, `db`, `df`, `lo`, `sc` |
| 3 | Migrate 2 legacy problems to JSON; switch curriculum day 1–3 |
| 4 | Deprecate `classics.ts` / Exercism / Groq from default `ingest` index |
| 5 | Batch-convert remaining curriculum slugs |

---

## 8. Testing

- **Unit:** `projectDigest`, `projectApproach`, callback parser, Telegram length truncation.
- **Fixture:** minimal `contains-duplicate.json` in `worker/test/fixtures/`.
- **Integration:** webhook test with mocked D1 row containing `content_json`.

---

## 9. Success criteria

- Edit `content/problems/contains-duplicate.json` → validate → emit → D1 execute → `/today` shows new copy without Groq.
- Approach button shows approach 1; “Next” shows approach 2; no single message >4096 chars.
- Solution reveals canonical implementation in user’s preferred language.
- Existing subscribers/progress/cron/queue unchanged.

---

## 10. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| JSON too large for D1 row | SQLite TEXT limit ~1MB; monitor size; split visuals if needed |
| Callback 64-byte limit | Short actions; validate slug length in schema |
| Dual code path (flat cols + JSON) | Emit keeps both in sync; remove flat cols in phase 5 |
| Message overflow | Truncation + multi-message send helper |

---

## Appendix: Canonical approach resolution

```typescript
function canonicalApproach(doc: ProblemContent) {
  const found = doc.approaches.find((a) => a.id === doc.canonicalApproachId);
  if (!found) throw new Error(`canonicalApproachId ${doc.canonicalApproachId} missing`);
  return found;
}
```

Solution code: `canonicalApproach(doc).implementations[lang]`.
