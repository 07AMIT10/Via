import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { serializeProblemApi } from "../src/api/problem-payload";
import type { ProblemRow } from "../src/db/repo";

describe("serializeProblemApi", () => {
  it("maps content_json to Mini App fields", async () => {
    const raw = await readFile(
      new URL("./fixtures/contains-duplicate.min.json", import.meta.url),
      "utf-8",
    );
    const row: ProblemRow = {
      id: 1,
      slug: "contains-duplicate",
      day_number: 1,
      title: "legacy title",
      description: "legacy description",
      pattern: "hashing",
      difficulty: "easy",
      key_insight: null,
      why_it_matters: null,
      applications_json: null,
      variations_json: null,
      complexity: null,
      hints_json: null,
      canonical_approach: null,
      canonical_solutions_json: null,
      content_json: raw,
    };

    const payload = serializeProblemApi(row, "python");
    expect(payload.description).toContain("at least twice");
    expect(payload.editor_stub).toContain("contains_duplicate");
    expect(payload.test_cases?.length).toBeGreaterThan(0);
  });
});
