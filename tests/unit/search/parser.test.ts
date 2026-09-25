import { describe, expect, it } from "vitest";
import { extractSearchTerms, sanitizeSearchQuery, toWebsearchQuery } from "@/modules/search/parser";

describe("search parser", () => {
  describe("sanitizeSearchQuery", () => {
    it("handles null and undefined", () => {
      expect(sanitizeSearchQuery(null)).toBe("");
      expect(sanitizeSearchQuery(undefined)).toBe("");
      expect(sanitizeSearchQuery("")).toBe("");
    });

    it("strips control characters and normalizes whitespace", () => {
      expect(sanitizeSearchQuery("hello\x00world\t\n  test")).toBe("hello world test");
    });
  });

  describe("extractSearchTerms", () => {
    it("extracts unique terms and phrases", () => {
      const terms = extractSearchTerms('nextjs "saas starter" react nextjs');
      expect(terms).toEqual(["nextjs", "saas starter", "react"]);
    });

    it("returns empty array for empty query", () => {
      expect(extractSearchTerms("   ")).toEqual([]);
    });
  });

  describe("toWebsearchQuery", () => {
    it("balances unmatched double quotes", () => {
      expect(toWebsearchQuery('hello "world')).toBe('hello "world"');
      expect(toWebsearchQuery('hello "world" test')).toBe('hello "world" test');
    });

    it("returns empty string on whitespace only", () => {
      expect(toWebsearchQuery("   ")).toBe("");
    });
  });
});
