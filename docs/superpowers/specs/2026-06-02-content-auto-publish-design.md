# Content Auto-Publish to D1 — Design Spec

**Date:** 2026-06-02  
**Status:** Approved  
**Goal:** When JSON problem content merges to `main`, production D1 is updated automatically so the Telegram bot reflects changes without manual `wrangler d1 execute`.

---

## Problem

Authors edit `content/problems/*.json` and merge to `main`, but the bot reads **Cloudflare D1**, not git. Without running ingest + remote seed, production stays stale. This caused confusion after the static JSON content system shipped.

## Solution

A dedicated GitHub Actions workflow runs on every **push to `main`** that touches content or ingest emit logic. It validates JSON, generates `ingest/seed.sql`, and applies it to remote D1 via Wrangler.

## Non-goals (v1)

- Publishing on pull requests (validate-only job is a future addition)
- Auto `wrangler deploy` (worker code unchanged when only JSON changes)
- Changing `subscribers.current_day` or scheduling
- Deleting D1 rows for problems removed from JSON (seed uses `INSERT OR REPLACE` only)
- Local/dev D1 sync (authors may still use local wrangler for dev)

---

## Trigger

| Event | Branch | Path filter |
|-------|--------|-------------|
| `push` | `main` | `content/problems/**`, `content/schema/**`, `ingest/**`, `.github/workflows/content-publish.yml` |

Reverts on `main` re-run the workflow and restore prior content from git.

## Pipeline

1. Checkout
2. Node 22
3. `content/schema`: `npm ci` + `npm run build`
4. `ingest`: `npm ci` + `npm run build` + `node dist/index.js`
   - Exit non-zero on Zod/curriculum errors → workflow fails, **no D1 write**
5. `worker`: `npm ci` (Wrangler CLI)
6. `wrangler d1 execute dsa-bot --remote --file=../ingest/seed.sql --yes`

Environment: `CLOUDFLARE_API_TOKEN` from GitHub Actions secrets.

## Secrets & permissions

- **Required:** `CLOUDFLARE_API_TOKEN` with D1 edit permission for database `dsa-bot` (ID in `worker/wrangler.toml`)
- **Optional:** `CLOUDFLARE_ACCOUNT_ID` if the token spans multiple accounts

Document setup in `README.md` and `SETUP.md`.

## Safety

- Ingest validation is the publish gate
- Worker already deployed continues to serve; only `problems` rows update
- `/today` still keyed by `subscribers.current_day`; publishing does not advance users

## Rollback

Revert the merge commit on `main` → push triggers workflow → previous JSON re-seeded.

## Success criteria

- Merge JSON edit to `main` → Action succeeds → remote D1 `content_json` length/content updates for affected slugs
- Invalid JSON merge → Action fails, D1 unchanged
- No manual `wrangler d1 execute` needed for routine content updates
