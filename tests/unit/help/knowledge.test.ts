import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  HELP_LOCALES,
  HELP_ROLES,
  KNOWLEDGE_DIR,
  buildKnowledge,
  parseGuide,
} from "@/modules/help/knowledge-build";
import generated from "@/modules/help/knowledge.generated.json";
import { getKnowledge, getKnowledgeForRole, getSuggestions } from "@/modules/help/knowledge";

const data = buildKnowledge();
const PLACEHOLDER = /\b(todo|tbd|lorem|ipsum|fixme|xxx|placeholder|coming soon)\b|<[^>]*>|\[\s*\]/i;
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

describe("help knowledge base", () => {
  it("generated JSON is fresh (run `pnpm help:build` if this fails)", () => {
    expect(generated).toEqual(JSON.parse(JSON.stringify(data)));
  });

  it("has the same files in en and hi", () => {
    const list = (l: string) => readdirSync(path.join(KNOWLEDGE_DIR, l)).sort();
    expect(list("hi")).toEqual(list("en"));
    expect(list("en").length).toBeGreaterThanOrEqual(30);
  });

  it("ids are unique and mirrored en/hi, and match the file name", () => {
    for (const locale of HELP_LOCALES) {
      const ids = data[locale].map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const f of readdirSync(path.join(KNOWLEDGE_DIR, locale))) {
        const e = parseGuide(readFileSync(path.join(KNOWLEDGE_DIR, locale, f), "utf8"), f);
        expect(`${e.id}.md`).toBe(f);
      }
    }
    expect(data.hi.map((e) => e.id)).toEqual(data.en.map((e) => e.id));
  });

  it("hi roles mirror en roles", () => {
    data.en.forEach((e, i) => expect(data.hi[i]!.roles).toEqual(e.roles));
  });

  for (const locale of HELP_LOCALES) {
    describe(locale, () => {
      for (const e of data[locale]) {
        it(`${e.id} is valid`, () => {
          expect(e.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
          expect(e.title.trim().length).toBeGreaterThan(3);
          expect(e.roles.length).toBeGreaterThan(0);
          for (const r of e.roles) expect(HELP_ROLES).toContain(r);
          expect(new Set(e.roles).size).toBe(e.roles.length);
          expect(e.keywords.length).toBeGreaterThanOrEqual(5);
          expect(new Set(e.keywords.map((k) => k.toLowerCase())).size).toBe(e.keywords.length);
          const n = words(e.body);
          expect(n, `${e.id} has ${n} words`).toBeGreaterThanOrEqual(35);
          expect(n, `${e.id} has ${n} words`).toBeLessThanOrEqual(150);
          expect(e.body).toMatch(/^1\. /m);
          expect(`${e.title} ${e.body} ${e.keywords.join(" ")}`).not.toMatch(PLACEHOLDER);
        });
      }
    });
  }

  it("hindi guides contain Devanagari", () => {
    for (const e of data.hi) expect(e.body).toMatch(/[ऀ-ॿ]/);
  });

  it("exposes role-filtered lookups", () => {
    expect(getKnowledge("en").length).toBe(data.en.length);
    const ids = (r: (typeof HELP_ROLES)[number]) => getKnowledgeForRole(r).map((e) => e.id);
    expect(ids("customer")).toContain("track-order");
    expect(ids("customer")).not.toContain("danger-zone-reset");
    expect(ids("super_admin")).toContain("danger-zone-reset");
    expect(ids("admin")).not.toContain("danger-zone-reset");
    expect(ids("staff")).not.toContain("record-payment");
    expect(ids("partner")).toContain("partners-payouts");
  });

  it("suggestion lists exist for every role in en and hi", () => {
    for (const role of [...HELP_ROLES, "guest"] as const) {
      for (const locale of HELP_LOCALES) {
        const list = getSuggestions(role, locale);
        expect(list.length).toBeGreaterThanOrEqual(6);
        expect(new Set(list).size).toBe(list.length);
        for (const q of list) expect(q.length).toBeLessThanOrEqual(60);
      }
    }
  });
});

describe("dashboard widget guides", () => {
  it.each(["staff", "admin", "super_admin"] as const)(
    "overdue follow-ups widget question hits the widget guide for %s with links",
    async (role) => {
      const { searchHelp } = await import("@/modules/help/search");
      const { GUIDE_THRESHOLD } = await import("@/modules/help/answer");
      const { hits } = searchHelp("what does overdue follow-ups widget do", role, "en");
      expect(hits[0]?.id).toBe("widget-overdue-follow-ups");
      expect(hits[0]?.score).toBeGreaterThanOrEqual(GUIDE_THRESHOLD);
      expect(hits[0]?.links?.[0]).toEqual({ label: "Open leads", path: "/admin/leads" });
    },
  );

  it("guides without links still load and every link path is absolute", async () => {
    const { knowledgeEntries } = await import("@/modules/help/knowledge");
    expect(knowledgeEntries.some((e) => !e.links)).toBe(true);
    for (const e of knowledgeEntries)
      for (const l of e.links ?? []) expect(l.path.startsWith("/")).toBe(true);
  });
});
