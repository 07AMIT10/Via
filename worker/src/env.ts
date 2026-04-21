export interface Env {
  DB: D1Database;
  CACHE: KVNamespace;
  BROADCAST_QUEUE: Queue;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  PAGES_URL: string;
}
