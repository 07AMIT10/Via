import { describe, expect, it } from "vitest";
import { digestKeyboard, renderDigest } from "../src/telegram/digest";

describe("digest helpers", () => {
  it("renders digest text with expected sections", () => {
    const text = renderDigest({
      day: 1,
      pattern: "hashing",
      difficulty: "easy",
      title: "Two Sum",
      description: "Find two indices with target sum.",
      keyInsight: "Use complement lookups.",
      whyItMatters: "Common interview primitive.",
      applications: ["Fraud checks", "Telemetry joins", "Search indexing"],
      variations: [{ title: "Two Sum II", oneLiner: "Sorted array variant." }],
      complexity: "O(n) time, O(n) space.",
    });

    expect(text).toContain("Day 1");
    expect(text).toContain("Key insight");
    expect(text).toContain("Complexity target");
  });

  it("builds keyboard with solve callback buttons", () => {
    const kb = digestKeyboard(12, "https://dsa.pages.dev");
    const serialized = JSON.stringify(kb);
    expect(serialized).toContain("Solve now");
    expect(serialized).toContain("h:12:1");
    expect(serialized).toContain("s:12");
  });
});
