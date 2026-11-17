import { beforeEach, describe, expect, it } from "vitest";
import { answerQuestion, clearHelpCache } from "@/modules/help/answer";
import { checkLink, visibleLinks } from "@/modules/help/links";
import type { KnowledgeEntry } from "@/modules/help/knowledge";
import { linkHref } from "@/components/help/paths";
import { splitAnswer } from "@/components/help/RichAnswer";
import { FIXTURE } from "./fixture";

type WithLinks = KnowledgeEntry & { links?: { label: string; path: string }[] };
const LINKS = [
  { label: "Orders", path: "/orders" },
  { label: "Ledger", path: "/admin/finance/ledger" },
  { label: "Audit log", path: "/audit" },
  { label: "My orders", path: "/account/orders" },
  { label: "Evil", path: "//evil.test/x" },
  { label: "Settings", path: "/admin-users" },
];
const ENTRIES: WithLinks[] = [
  {
    id: "fulfil-order",
    title: "Fulfil an order",
    roles: ["staff", "admin", "super_admin"],
    keywords: ["fulfil", "ship order", "deliver"],
    body: "Open the order.\n1. Pick items.\n2. Mark shipped.\n\nTip: check the address first.",
    locale: "en",
    links: LINKS,
  },
  {
    id: "order-status",
    title: "Order status meanings",
    roles: ["staff", "admin", "super_admin"],
    keywords: ["status", "order"],
    body: "Statuses explained.",
    locale: "en",
  },
  {
    id: "no-links-guide",
    title: "Order notes",
    roles: ["staff", "admin", "super_admin"],
    keywords: ["notes", "order"],
    body: "Add notes.",
    locale: "en",
  },
  ...(FIXTURE as WithLinks[]),
];
const cfg = { ai: false, hindi: false };
const NOW = () => new Date("2026-11-17T10:00:00Z");
beforeEach(() => clearHelpCache());

describe("link role filter", () => {
  it("staff: admin screens canonicalised; admin-only, customer and unsafe dropped", () => {
    expect(visibleLinks(LINKS, "staff").map((l) => l.path)).toEqual(["/admin/orders"]);
  });
  it("admin gets ledger/audit/admin-users; capped at 3", () => {
    const v = visibleLinks(LINKS, "admin");
    expect(v.map((l) => l.path)).toEqual([
      "/admin/orders",
      "/admin/finance/ledger",
      "/admin/audit",
    ]);
  });
  it("partner only /account, never admin or external", () => {
    expect(visibleLinks(LINKS, "partner").map((l) => l.path)).toEqual(["/account/orders"]);
    expect(checkLink({ label: "x", path: "/admin/orders" }, "customer")).toBeNull();
  });
  it("tolerates missing/garbage links field", () => {
    expect(visibleLinks(undefined, "admin")).toEqual([]);
    expect(visibleLinks([null, 3, { label: 1 }], "admin")).toEqual([]);
  });
});

describe("answer links + related", () => {
  it("guide: links (role-checked) and up to 3 related other hits", async () => {
    const r = await answerQuestion(
      { role: "admin", locale: "en", userId: "u", query: "fulfil ship order deliver" },
      { entries: ENTRIES, config: cfg, now: NOW, llm: null },
    );
    expect(r.mode).toBe("guide");
    expect(r.links?.map((l) => l.path)).toContain("/admin/finance/ledger");
    expect(r.related?.every((x) => x.id !== "fulfil-order")).toBe(true);
    expect((r.related ?? []).length).toBeLessThanOrEqual(3);
    const staff = await answerQuestion(
      { role: "staff", locale: "en", userId: "u2", query: "fulfil ship order deliver" },
      { entries: ENTRIES, config: cfg, now: NOW, llm: null },
    );
    expect(staff.links?.map((l) => l.path)).not.toContain("/admin/audit");
  });
  it("works when entries have no links field at all", async () => {
    const r = await answerQuestion(
      { role: "customer", locale: "en", userId: "u", query: "how do I reset my password" },
      { entries: FIXTURE, config: cfg, now: NOW, llm: null },
    );
    expect(r.mode).toBe("guide");
    expect(r.links).toBeUndefined();
  });
  it("search mode: honest text, related chips, no 'see other topics' list", async () => {
    const r = await answerQuestion(
      { role: "staff", locale: "en", userId: "u", query: "order banana pineapple kiwi mango" },
      { entries: ENTRIES, config: cfg, now: NOW, llm: null },
    );
    expect(r.mode).toBe("search");
    expect(r.answer).toBe("I could not find an exact guide. Closest topics:");
    expect(r.related?.length).toBeGreaterThan(0);
    expect(r.answer).not.toMatch(/^- /m);
  });
});

describe("linkHref host resolution", () => {
  const A = "https://admin.example.com";
  const S = "https://example.com";
  it("admin path on site host -> absolute admin URL, no /admin prefix", () => {
    expect(linkHref("/admin/orders", S, A, S)).toBe("https://admin.example.com/orders");
  });
  it("admin path on admin host -> relative", () => {
    expect(linkHref("/admin/orders", A, A, S)).toBe("/orders");
    expect(linkHref("/admin", A, A, S)).toBe("/dashboard");
  });
  it("site path on admin host -> absolute site URL; on site host relative", () => {
    expect(linkHref("/account/orders", A, A, S)).toBe("https://example.com/account/orders");
    expect(linkHref("/account/orders", S, A, S)).toBe("/account/orders");
  });
  it("unknown admin origin off the admin host hides the link; unsafe path rejected", () => {
    expect(linkHref("/admin/orders", S, undefined, S)).toBeNull();
    expect(linkHref("//evil.test", S, A, S)).toBeNull();
  });
});

describe("splitAnswer", () => {
  it("summary + steps + tip", () => {
    const p = splitAnswer(
      "Mark an order shipped.\n1. Open it.\n2. Press Ship.\n\nTip: check address.",
      "guide",
    );
    expect(p.summary).toBe("Mark an order shipped.");
    expect(p.rest.map((b) => b.t)).toEqual(["ol"]);
    expect(p.tip).toBe("check address.");
  });
  it("steps-only guide uses title as summary; search has none", () => {
    expect(splitAnswer("1. A\n2. B", "guide", "Title").summary).toBe("Title");
    expect(splitAnswer("Closest topics:", "search").summary).toBeNull();
  });
});
