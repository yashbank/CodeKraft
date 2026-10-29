import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { csvCell, toCsv } from "@/lib/admin/csv";
import { deleteView, listViews, saveView } from "@/lib/admin/saved-views";
import { computeSetupChecklist, type SetupInput } from "@/lib/admin/setup-checklist";
import { isPaletteShortcut, quickActionsFor } from "@/lib/admin/palette";

describe("csv", () => {
  it("quotes, escapes and neutralises formulas", () => {
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    for (const f of ["=SUM(A1)", "+1", "-1", "@x"]) expect(csvCell(f)).toBe(`'${f}`);
    expect(csvCell(null)).toBe("");
    expect(csvCell(12)).toBe("12");
    expect(toCsv(["a", "b"], [["=x", 1]])).toBe("a,b\r\n'=x,1\r\n");
  });
});

describe("saved views", () => {
  const mem = () => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
    };
  };
  it("creates, lists per user/screen, replaces by name and deletes", () => {
    const s = mem();
    saveView(s, "u1", "ledger", "Refunds", "?type=refund");
    saveView(s, "u1", "ledger", "Refunds", "type=payment");
    saveView(s, "u1", "expenses", "Other", "");
    const v = listViews(s, "u1", "ledger");
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ name: "Refunds", query: "type=payment" });
    expect(listViews(s, "u2", "ledger")).toEqual([]);
    expect(saveView(s, "u1", "ledger", "  ", "x")).toHaveLength(1);
    expect(deleteView(s, "u1", "ledger", v[0]!.id)).toEqual([]);
  });
  it("survives corrupt storage", () => {
    expect(listViews({ getItem: () => "{oops", setItem: () => {} }, "u", "s")).toEqual([]);
  });
});

describe("setup checklist", () => {
  const base: SetupInput = {
    siteName: "",
    siteLogo: null,
    gstin: null,
    sellerDetails: null,
    razorpayKeyId: null,
    upiVpa: null,
    bankDetails: null,
    emailProblem: "x",
    publishedProducts: 0,
    superAdmins: 1,
  };
  it("is all pending on a fresh install", () => {
    expect(computeSetupChecklist(base).every((i) => !i.done)).toBe(true);
  });
  it("computes each item from data", () => {
    const items = computeSetupChecklist({
      ...base,
      siteName: "Acme",
      siteLogo: "/l.png",
      gstin: "27AAAAA0000A1Z5",
      sellerDetails: {},
      upiVpa: "a@upi",
      emailProblem: null,
      publishedProducts: 2,
      superAdmins: 2,
    });
    expect(items.every((i) => i.done)).toBe(true);
    const seller = computeSetupChecklist({ ...base, gstin: "g" }).find((i) => i.id === "seller");
    expect(seller?.done).toBe(false);
    const pay = computeSetupChecklist({ ...base, razorpayKeyId: "rzp" }).find(
      (i) => i.id === "payments",
    );
    expect(pay?.done).toBe(true);
  });
});

describe("palette helpers", () => {
  const href = (r: string) => `/admin${r}`;
  it("filters quick actions by role", () => {
    const labels = (r: Parameters<typeof quickActionsFor>[0]) =>
      quickActionsFor(r, href).map((a) => a.label);
    expect(labels("super_admin")).toEqual([
      "New product",
      "New coupon",
      "Record expense",
      "Invite user",
    ]);
    expect(labels("admin")).not.toContain("Invite user");
    expect(labels(undefined)).toEqual([]);
    expect(quickActionsFor("super_admin", href)[0]).toMatchObject({
      group: "Actions",
      href: "/admin/products/new",
    });
  });
  it("opens on Cmd/Ctrl+K and on / outside fields only", () => {
    const e = (o: object) => ({ key: "", metaKey: false, ctrlKey: false, target: null, ...o });
    expect(isPaletteShortcut(e({ key: "k", metaKey: true }))).toBe(true);
    expect(isPaletteShortcut(e({ key: "K", ctrlKey: true }))).toBe(true);
    expect(isPaletteShortcut(e({ key: "/" }))).toBe(true);
    expect(isPaletteShortcut(e({ key: "/", target: document.createElement("input") }))).toBe(false);
    expect(isPaletteShortcut(e({ key: "k" }))).toBe(false);
  });
});

describe("page transition", () => {
  it("is disabled under prefers-reduced-motion and the in-app switch", () => {
    const css = readFileSync("src/styles/tokens.css", "utf8");
    expect(css).toMatch(/\.admin-page-enter\s*\{\s*animation: ck-admin-page-enter/);
    const reduce = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduce).toMatch(/\.admin-page-enter\s*\{\s*animation: none;/);
    expect(css).toMatch(/\[data-motion="reduce"\] \.admin-page-enter\s*\{\s*animation: none;/);
  });
});

describe("export route", () => {
  it("reuses the screen filters and emits safe CSV", async () => {
    const listLedger = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            seq: 1,
            entryType: "payment",
            partyType: "company",
            partnerId: null,
            amount: { amountMinor: 1000, currency: "INR" },
            amountInrMinor: 1000,
            fxRateToInr: "1",
            memo: "=HYPERLINK(1)",
            createdAt: "2026-01-01",
            createdBy: "u",
            links: {},
          },
        ],
        nextCursor: null,
      },
    });
    vi.doMock("@/lib/authz/admin-request-context", () => ({
      getAdminRequestContext: async () => ({}),
    }));
    vi.doMock("@/modules/finance/queries", () => ({ listLedgerEntriesQuery: listLedger }));
    vi.doMock("@/modules/users/queries", () => ({
      listPartnersQuery: async () => ({ ok: false }),
    }));
    vi.doMock("@/lib/admin/expenses-data", () => ({ loadExpenseRows: vi.fn() }));
    const { GET } = await import("@/app/api/admin/export/[kind]/route");
    const res = await GET(
      new Request("http://x/api/admin/export/ledger?type=sale&from=2026-01-01"),
      { params: Promise.resolve({ kind: "ledger" }) },
    );
    expect(res.headers.get("content-type")).toContain("text/csv");
    const body = await res.text();
    expect(body).toContain("'=HYPERLINK(1)");
    expect(listLedger.mock.calls[0]![0].filters).toMatchObject({
      dateFrom: "2026-01-01",
      entryType: ["sale"],
    });
    const bad = await GET(new Request("http://x/api/admin/export/nope"), {
      params: Promise.resolve({ kind: "nope" }),
    });
    expect(bad.status).toBe(404);
  });
});
