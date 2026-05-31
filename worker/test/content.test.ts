import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseProblemContent } from "../src/content/parse";
import { projectApproach, projectDigest, projectDryRun } from "../src/content/projections";

describe("content projections", () => {
  it("builds digest under 4000 chars", async () => {
    const raw = await readFile(
      new URL("./fixtures/contains-duplicate.min.json", import.meta.url),
      "utf-8",
    );
    const doc = parseProblemContent(raw);
    expect(doc).not.toBeNull();
    const { html, length } = projectDigest(doc!);
    expect(length).toBeLessThan(4000);
    expect(html).toContain("Contains Duplicate");
  });

  it("projects approach by index", async () => {
    const raw = await readFile(
      new URL("./fixtures/contains-duplicate.min.json", import.meta.url),
      "utf-8",
    );
    const doc = parseProblemContent(raw);
    expect(doc).not.toBeNull();
    const msg = projectApproach(doc!, 0);
    expect(msg.html).toContain("Brute Force");
  });

  it("projects dry run when present", async () => {
    const raw = await readFile(
      new URL("./fixtures/contains-duplicate.min.json", import.meta.url),
      "utf-8",
    );
    const doc = parseProblemContent(raw)!;
    expect(projectDryRun(doc, 0)).toBeNull();
    expect(projectDryRun(doc, 1)).toContain("duplicate");
  });
});
