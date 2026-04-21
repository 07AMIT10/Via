import { describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/env";

function envWithProblem(): Env {
  return {
    DB: {
      prepare: vi.fn().mockImplementation((sql: string) => {
        if (sql.includes("FROM problems") && sql.includes("WHERE id")) {
          return {
            bind: vi.fn().mockReturnValue({
              first: vi.fn().mockResolvedValue({
                id: 1,
                day_number: 1,
                title: "Two Sum",
                description: "desc",
                pattern: "hashing",
                difficulty: "easy",
                key_insight: "insight",
                why_it_matters: "why",
                applications_json: "[]",
                variations_json: "[]",
                complexity: "O(n)",
                hints_json: "[]",
                canonical_approach: "approach",
                canonical_solutions_json: "{}",
              }),
            }),
          };
        }
        return {
          bind: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(null),
            run: vi.fn().mockResolvedValue({}),
          }),
          all: vi.fn().mockResolvedValue({ results: [] }),
        };
      }),
    } as unknown as D1Database,
    CACHE: {} as KVNamespace,
    BROADCAST_QUEUE: {} as Queue,
    TELEGRAM_BOT_TOKEN: "token",
    TELEGRAM_WEBHOOK_SECRET: "secret",
    PAGES_URL: "https://pages.example",
  };
}

describe("api routes", () => {
  it("rejects /api/problem/:id without auth header", async () => {
    const env = envWithProblem();
    const req = new Request("https://x/api/problem/1");
    const res = await worker.fetch(req, env);
    expect(res.status).toBe(401);
  });
});
