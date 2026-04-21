# DSA Daily Bot

This repository is now a TypeScript-first DSA learning bot stack:

- `worker/`: Cloudflare Worker for Telegram webhook, scheduling, and APIs
- `app/`: Telegram Mini App frontend (to be implemented in Week 3)
- `ingest/`: content pipeline for MIT-licensed DSA problems + Groq enrichment
- `infra/`: Judge0 and OCI provisioning assets

## Week 1 status

Implemented:

- Worker scaffold (`worker/`)
- Telegram webhook route with secret token validation
- Basic commands: `/start`, `/today`, `/pause`, `/resume`
- Initial D1 schema in `worker/src/db/schema.sql`
- Basic tests in `worker/test/webhook.test.ts`

In progress (Week 2 scaffolding):

- Ingest pipeline skeleton in `ingest/src/` (`classics`, `validate`, `emit-sql`, `index`)
- Starter curriculum in `content/problems/curriculum.json`
- Telegram digest builder in `worker/src/telegram/digest.ts`
- Callback scaffolding in `worker/src/telegram/callbacks.ts`
- Recap cron scaffolding in `worker/src/cron/recap.ts`

Latest progress:

- `/today` pulls real problem rows from D1 and sends digest + action keyboard.
- Daily cron enqueues subscriber deliveries; queue consumer sends digest messages.
- Callback actions now handle hint reveal, mark read/attempted/skip, approach reveal, and gated solution reveal.
- `/progress` is live and `/lang <python|go|rust>` sets recap solution language.
- Recap cron now sends actual canonical approach + preferred-language reference solution.
- Ingest now supports optional Groq enrichment via `GROQ_API_KEY`.
- First 12 classic problems now contain concrete titles/descriptions/examples/hints/complexity metadata (no placeholder examples).
- Ingest validation now enforces minimum quality (hints/examples/apps/variations + per-language solutions/tests presence).
- `/recap` now works on demand and sends latest non-solved problem's approach + preferred-language solution.
- Added digest helper unit tests in `worker/test/digest.test.ts`.

## Local setup (Worker)

1. Install dependencies:
   - `cd worker && npm install`
2. Create Cloudflare resources and update IDs in `worker/wrangler.toml`.
3. Set secrets:
   - `wrangler secret put TELEGRAM_BOT_TOKEN`
   - `wrangler secret put TELEGRAM_WEBHOOK_SECRET`
   - `wrangler secret put PAGES_URL`
4. Apply schema:
   - `wrangler d1 execute dsa-bot --file=src/db/schema.sql`
5. Run locally:
   - `npm run dev`
