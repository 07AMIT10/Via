# Content Auto-Publish — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task.

**Goal:** Auto-sync `content/problems` JSON to remote D1 on every push to `main` that changes content or ingest.

**Architecture:** Dedicated `.github/workflows/content-publish.yml`; ingest validates and emits SQL; Wrangler applies seed remotely using `CLOUDFLARE_API_TOKEN`.

**Tech Stack:** GitHub Actions, Node 22, ingest pipeline, Wrangler 4, Cloudflare D1.

---

### Task 1: Content publish workflow

**Files:**
- Create: `.github/workflows/content-publish.yml`

- [ ] Add workflow with `on.push.branches: [main]` and path filters
- [ ] Steps: schema build → ingest build + emit → wrangler d1 execute remote
- [ ] Set `env.CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}`
- [ ] Use `npm ci` in schema, ingest, worker

### Task 2: Document GitHub secret

**Files:**
- Modify: `README.md`, `SETUP.md`

- [ ] Add section: create Cloudflare API token, add `CLOUDFLARE_API_TOKEN` repo secret
- [ ] Note: merge to `main` publishes content; local wrangler optional for dev

### Task 3: Verify

- [ ] Push branch, merge (or workflow_dispatch if added later)
- [ ] Confirm Action green and D1 query shows updated `content_json`

```bash
# After merge, optional manual check
cd worker
npx wrangler d1 execute dsa-bot --remote --command \
  "SELECT day_number, slug, length(content_json) FROM problems WHERE content_json IS NOT NULL ORDER BY day_number;" --yes
```

---

## Commit

```bash
git add .github/workflows/content-publish.yml docs/superpowers/specs/2026-06-02-content-auto-publish-design.md docs/superpowers/plans/2026-06-02-content-auto-publish.md README.md SETUP.md
git commit -m "ci: auto-publish content JSON to D1 on push to main"
```
