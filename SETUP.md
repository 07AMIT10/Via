# DSA Bot Full Setup Guide

This guide covers complete setup for local development and cloud deployment of the DSA learning bot stack:

- Cloudflare Worker (Telegram webhook, API, cron, queue consumers)
- Cloudflare D1/KV/Queues
- Telegram bot and Mini App
- React Mini App frontend
- Ingest pipeline (JSON content validate/emit; legacy classic + Exercism + Groq behind `INGEST_LEGACY=1`)
- Judge0 runtime (OCI VM or fallback VPS)

## 1) Prerequisites

Install these locally:

- Node.js 22+
- npm 9+
- Git
- Cloudflare Wrangler CLI
- (Optional) OCI CLI for Oracle provisioning

Verify:

```bash
node -v
npm -v
git --version
wrangler --version
```

## 2) Clone and install dependencies

```bash
git clone <your-repo-url>
cd Via

cd worker && npm install && cd ..
cd app && npm install && cd ..
cd ingest && npm install && cd ..
```

## 3) Cloudflare setup

Login:

```bash
wrangler login
```

Create resources (once):

```bash
wrangler d1 create dsa-bot
wrangler kv namespace create CACHE
wrangler queues create broadcast
```

Update IDs in `worker/wrangler.toml`:

- `database_id`
- `kv namespace id`

Set Worker secrets:

```bash
cd worker
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_WEBHOOK_SECRET
wrangler secret put PAGES_URL
wrangler secret put JUDGE0_URL
wrangler secret put JUDGE0_AUTH_TOKEN
```

## 4) Database schema migration

From `worker/`:

```bash
wrangler d1 execute dsa-bot --file=src/db/schema.sql --remote
```

## 5) Telegram bot setup

1. Use [@BotFather](https://t.me/BotFather):
   - create bot
   - capture bot token
2. Configure webhook after Worker deploy:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://<your-worker-domain>/telegram/webhook",
    "secret_token":"<TELEGRAM_WEBHOOK_SECRET>"
  }'
```

3. In Telegram, message your bot:
   - `/start`
   - `/today`
   - `/progress`

## 6) Ingest content into D1

Prepare env for enrichment (optional):

```bash
export GROQ_API_KEY=<your_key>
```

Author problems under `content/problems/<slug>.json` (see `content/schema/`). Day 1 uses `contains-duplicate.json`.

Run ingest (default: validate JSON + emit SQL):

```bash
cd ingest
npm run build
node dist/index.js
```

For the legacy classics/Exercism/Groq path: `INGEST_LEGACY=1 node dist/index.js`.

This writes `ingest/seed.sql` with a `content_json` column per problem.

Apply seed:

```bash
cd ../worker
wrangler d1 execute dsa-bot --file=../ingest/seed.sql --remote
```

## 7) Worker deploy

From `worker/`:

```bash
wrangler deploy
```

Save deployed URL for:

- Telegram webhook URL
- `VITE_WORKER_BASE_URL` in Mini App

## 8) Mini App local + deploy

Create `app/.env.local`:

```env
VITE_WORKER_BASE_URL=https://<your-worker-domain>
```

Run locally:

```bash
cd app
npm run dev
```

Build:

```bash
npm run build
```

Deploy with Cloudflare Pages (example):

```bash
wrangler pages project create dsa-bot-app
wrangler pages deploy dist --project-name dsa-bot-app
```

Set `PAGES_URL` Worker secret to the Pages URL and redeploy worker.

## 9) Judge0 deployment (OCI recommended)

### 9.1 Provision VM

- region: `ap-hyderabad-1`
- shape: `VM.Standard.A1.Flex`
- size: `4 OCPU / 24GB`
- Ubuntu 22.04+

If capacity fails repeatedly, use:

- `infra/oci/capacity-bot.md` instructions
- fallback VPS (Hetzner CX22)

### 9.2 Bootstrap VM

Use cloud-init from:

- `infra/oci/cloud-init.yaml`

### 9.3 Deploy Judge0 stack

Copy `infra/judge0/*` to VM path, e.g. `/opt/dsa-bot/judge0`.

Create `.env` in that directory:

```env
JUDGE0_TOKEN=<long-random-token>
POSTGRES_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
```

Start:

```bash
cd /opt/dsa-bot/judge0
docker compose up -d
```

Smoke test:

```bash
curl http://<judge0-host>/languages
```

Set Worker secrets to point at Judge0:

```bash
cd worker
wrangler secret put JUDGE0_URL
wrangler secret put JUDGE0_AUTH_TOKEN
wrangler deploy
```

## 10) Scheduled jobs / queues

Configured in `worker/wrangler.toml`:

- `0 13 * * *` -> daily broadcast enqueue
- `30 13 * * *` -> recap cron

Queue:

- producer binding: `BROADCAST_QUEUE`
- consumer processes broadcast batches

Manual scheduled test:

```bash
cd worker
wrangler dev --test-scheduled
```

## 11) CI workflows

Included:

- `.github/workflows/worker.yml` (worker tests)
- `.github/workflows/pages.yml` (Mini App build)

Ensure GitHub repo secrets/settings are configured if you later add deploy steps.

## 12) End-to-end validation checklist

1. `/start` subscribes user.
2. `/today` sends digest with inline actions.
3. callback buttons:
   - hint/read/approach/skip/solution behave correctly.
4. recap cron sends approach + preferred-language solution.
5. Mini App opens from Telegram button.
6. `Run` and `Submit` return verdict + status metadata.
7. accepted submit advances `current_day`.
8. `/progress` reflects solved/attempted/read/skipped + streak.

## 13) Troubleshooting

### Telegram webhook not receiving updates

- Verify webhook URL + secret token:
  - `getWebhookInfo` via Telegram API
- Check worker logs:
  - `wrangler tail`

### `/api/today` returns 401

- Mini App must send `Authorization: tma <initData>`.
- Validate bot token used for signature matches running bot.

### Judge0 verdict always stub

- `JUDGE0_URL` and `JUDGE0_AUTH_TOKEN` missing in Worker secrets.
- Re-set secrets and redeploy Worker.

### D1 has no problems

- Ensure ingest generated `seed.sql`.
- Re-run:
  - `wrangler d1 execute dsa-bot --file=../ingest/seed.sql --remote`

### OCI A1 capacity unavailable

- Retry with capacity bot flow (`infra/oci/capacity-bot.md`)
- fallback to Hetzner CX22

## 14) Useful commands quick reference

```bash
# worker tests
cd worker && npm run test

# app build
cd app && npm run build

# ingest run
cd ingest && npm run build && node dist/index.js

# worker deploy
cd worker && wrangler deploy

# tail logs
cd worker && wrangler tail
```
