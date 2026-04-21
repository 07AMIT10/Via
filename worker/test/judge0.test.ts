import { describe, expect, it } from "vitest";
import { runJudge0 } from "../src/judge0/client";
import type { Env } from "../src/env";

function envWithoutJudge0(): Env {
  return {
    DB: {} as D1Database,
    CACHE: {} as KVNamespace,
    BROADCAST_QUEUE: {} as Queue,
    TELEGRAM_BOT_TOKEN: "token",
    TELEGRAM_WEBHOOK_SECRET: "secret",
    PAGES_URL: "https://pages.example",
  };
}

describe("judge0 client", () => {
  it("returns stub when Judge0 env is missing", async () => {
    const result = await runJudge0(envWithoutJudge0(), {
      language: "python",
      code: "print('hi')",
      wait: true,
    });
    expect(result.verdict).toBe("stub");
  });

  it("preserves output text in stub fallback", async () => {
    const result = await runJudge0(envWithoutJudge0(), {
      language: "go",
      code: "package main",
      wait: true,
    });
    expect(result.output).toContain("not configured");
  });
});
