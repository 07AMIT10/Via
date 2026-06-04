import { describe, expect, it } from "vitest";
import {
  adjacentBrowsable,
  resolveBrowseAnchor,
  type BrowsableProblem,
} from "../src/db/browse";

const catalog: BrowsableProblem[] = [
  { day_number: 1, slug: "contains-duplicate", title: "Contains Duplicate" },
  { day_number: 5, slug: "valid-anagram", title: "Valid Anagram" },
  { day_number: 19, slug: "top-k-frequent-elements", title: "Top K" },
];

describe("browse navigation", () => {
  it("resolves anchor from browse_day when set", () => {
    expect(resolveBrowseAnchor(catalog, 5, 1)).toBe(5);
  });

  it("falls back to current_day when browse_day unset", () => {
    expect(resolveBrowseAnchor(catalog, null, 1)).toBe(1);
  });

  it("steps to next problem by day order", () => {
    expect(adjacentBrowsable(catalog, 1, "next")?.slug).toBe("valid-anagram");
    expect(adjacentBrowsable(catalog, 5, "next")?.slug).toBe("top-k-frequent-elements");
  });

  it("returns null at end of catalog", () => {
    expect(adjacentBrowsable(catalog, 19, "next")).toBeNull();
  });

  it("steps to previous problem", () => {
    expect(adjacentBrowsable(catalog, 5, "prev")?.slug).toBe("contains-duplicate");
  });
});
