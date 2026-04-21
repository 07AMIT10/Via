import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/env";

function createEnv(): Env {
  return {
    DB: {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockResolvedValue({}),
        }),
      }),
    } as unknown as D1Database,
    CACHE: {} as KVNamespace,
    BROADCAST_QUEUE: {} as Queue,
    TELEGRAM_BOT_TOKEN: "token",
    TELEGRAM_WEBHOOK_SECRET: "secret",
    PAGES_URL: "https://example.pages.dev",
  };
}

describe("worker fetch", () => {
  it("returns health", async () => {
    const env = createEnv();
    const res = await worker.fetch(new Request("https://x/health"), env);
    expect(res.status).toBe(200);
  });

  it("rejects unauthorized webhook", async () => {
    const env = createEnv();
    const req = new Request("https://x/telegram/webhook", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "content-type": "application/json" },
    });
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(401);
  });
});
