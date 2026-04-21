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
