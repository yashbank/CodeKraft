import { describe, expect, it } from "vitest";
import { pickSnippet, searchHelp, stem, tokenize } from "@/modules/help/search";
import { FIXTURE } from "./fixture";

describe("tokenize", () => {
  it("lowercases, drops stopwords, stems, keeps Devanagari whole", () => {
    expect(tokenize("How do I download Invoices?")).toEqual(["download", "invoice"]);
    expect(tokenize("पासवर्ड रीसेट कैसे करें")).toEqual(["पासवर्ड", "रीसेट"]);
    expect(stem("passwords")).toBe("password");
    expect(stem("policies")).toBe("policy");
    expect(stem("cat")).toBe("cat");
  });
});

describe("searchHelp", () => {
  it("ranks the matching English guide first with high score", () => {
    const { hits } = searchHelp("how to reset my password", "customer", "en", FIXTURE);
    expect(hits[0]?.id).toBe("reset-password");
    expect(hits[0]!.score).toBeGreaterThan(0.6);
    expect(hits.length).toBeLessThanOrEqual(3);
  });

  it("matches synonyms through keywords", () => {
    expect(searchHelp("I need my receipt", "customer", "en", FIXTURE).hits[0]?.id).toBe(
      "download-invoice",
    );
    expect(searchHelp("cannot sign in", "customer", "en", FIXTURE).hits[0]?.id).toBe(
      "reset-password",
    );
  });

  it("answers Hindi queries from Hindi entries", () => {
    const { hits } = searchHelp("पासवर्ड भूल गया", "customer", "hi", FIXTURE);
    expect(hits[0]?.id).toBe("reset-password");
    expect(hits[0]?.title).toBe("पासवर्ड रीसेट करें");
  });

  it("falls back to English entries when no Hindi version exists", () => {
    const { hits } = searchHelp("download invoice", "customer", "hi", FIXTURE);
    expect(hits[0]?.id).toBe("download-invoice");
  });

  it("filters by role", () => {
    expect(searchHelp("approve quote", "customer", "en", FIXTURE).hits).toEqual([]);
    expect(searchHelp("approve quote", "staff", "en", FIXTURE).hits[0]?.id).toBe("approve-quote");
    expect(
      searchHelp("manage staff roles", "admin", "en", FIXTURE).hits.map((h) => h.id),
    ).not.toContain("manage-roles");
    expect(searchHelp("manage staff roles", "super_admin", "en", FIXTURE).hits[0]?.id).toBe(
      "manage-roles",
    );
  });

  it("returns nothing for empty or stopword-only queries and gives low score to gibberish", () => {
    expect(searchHelp("   ", "customer", "en", FIXTURE).hits).toEqual([]);
    expect(searchHelp("how do i", "customer", "en", FIXTURE).hits).toEqual([]);
    expect(searchHelp("zzqx wibble", "customer", "en", FIXTURE).hits).toEqual([]);
  });
});

describe("pickSnippet", () => {
  it("prefers relevant paragraphs and respects the cap", () => {
    const s = pickSnippet(FIXTURE[0]!.body, "link expires", 60);
    expect(s).toContain("expires");
    expect(s.length).toBeLessThanOrEqual(60);
  });
});
