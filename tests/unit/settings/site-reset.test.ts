import { describe, expect, it } from "vitest";
import { buildContext } from "@/lib/authz/context";
import {
  RESET_STEPS,
  expandCategories,
  stepsFor,
  type ResetCategory,
} from "@/modules/settings/site-reset-plan";
import { requestSiteReset, runReset, type ResetDb } from "@/modules/settings/site-reset";
import { describeApproval } from "@/lib/admin/approval-text";

const ctxFor = (roles: string[]) =>
  buildContext({
    user: { id: "u1" },
    session: { id: "s1" },
    roles: roles as never,
  });

function fakeDb() {
  const log: string[] = [];
  const db: ResetDb = {
    run: async (t) => {
      log.push(t);
      return t.startsWith("SELECT count") ? [{ c: 3 }] : [];
    },
  };
  return { db, log };
}

describe("site reset plan", () => {
  it("maps categories to tables and pulls in FK dependencies", () => {
    expect(stepsFor(["leads"]).map((s) => s.table)).toEqual(["lead_activities", "leads"]);
    expect(expandCategories(["customers_orders"])).toEqual([
      "leads",
      "quotes",
      "customers_orders",
      "finance",
    ]);
    expect(expandCategories(["products"])).toHaveLength(6);
  });

  it("deletes children before parents", () => {
    const order = RESET_STEPS.map((s) => s.table);
    const before = (child: string, parent: string) =>
      expect(order.indexOf(child)).toBeLessThan(order.indexOf(parent));
    before("ledger_entries", "payments");
    before("order_items", "orders");
    before("orders", "custom_quotes");
    before("lead_activities", "leads");
    before("testimonials", "products");
    before("offerings", "products");
    before("entitlements", "payments");
    before("orders", "users");
    before("accounts", "users");
    expect(order.at(-1)).toBe("users");
  });

  it("handles the credit_notes/refunds cycle, quotes dependency and customer media", async () => {
    const order = RESET_STEPS.map((s) => s.table);
    expect(order.indexOf("credit_notes")).toBeLessThan(order.indexOf("refunds"));
    expect(RESET_STEPS.find((s) => s.table === "credit_notes")?.before).toContain("credit_note_id");
    expect(expandCategories(["quotes"])).toContain("customers_orders");
    expect(order.indexOf("media")).toBeLessThan(order.indexOf("users"));
    expect(RESET_STEPS.find((s) => s.table === "media")?.customersOnly).toBe("uploaded_by");
    const { db, log } = fakeDb();
    await runReset(db, ["quotes"]);
    expect(log.findIndex((l) => l.startsWith("UPDATE"))).toBeLessThan(
      log.findIndex((l) => l.startsWith('DELETE FROM "credit_notes"')),
    );
  });

  it("never touches protected tables and only deletes customer users", () => {
    const tables = new Set(RESET_STEPS.map((s) => s.table));
    for (const keep of ["site_settings", "audit_logs", "roles", "permissions", "legal_pages"]) {
      expect(tables.has(keep)).toBe(false);
    }
    const all = [
      "leads",
      "quotes",
      "customers_orders",
      "products",
      "content",
      "finance",
    ] as ResetCategory[];
    const { db, log } = fakeDb();
    return runReset(db, all).then(() => {
      const del = log.filter((l) => l.startsWith("DELETE"));
      const userDel = del.find((l) => l.startsWith('DELETE FROM "users"'))!;
      expect(userDel).toContain("NOT IN (SELECT user_id FROM user_roles");
      expect(userDel).toContain("'super_admin'");
      expect(del.filter((l) => l.startsWith('DELETE FROM "user_roles"'))[0]).toContain("NOT IN");
      // triggers off before, on after
      expect(log[0]).toMatch(/DISABLE TRIGGER USER/);
      expect(log.at(-1)).toMatch(/ENABLE TRIGGER USER/);
    });
  });
});

describe("requestSiteReset", () => {
  const deps = (created: ResetCategory[][] = []) => ({
    siteName: async () => "CodeKraft",
    create: async (_c: unknown, cats: ResetCategory[]) => {
      created.push(cats);
      return "appr-1";
    },
  });

  it("rejects non super admins", async () => {
    await expect(
      requestSiteReset(
        ctxFor(["admin"]) as never,
        { categories: ["leads"], confirmName: "CodeKraft" },
        deps(),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a wrong typed site name", async () => {
    const created: ResetCategory[][] = [];
    await expect(
      requestSiteReset(
        ctxFor(["super_admin"]) as never,
        { categories: ["leads"], confirmName: "codekraft" },
        deps(created),
      ),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(created).toHaveLength(0);
  });

  it("creates the approval for a super admin with the exact name", async () => {
    const created: ResetCategory[][] = [];
    const r = await requestSiteReset(
      ctxFor(["super_admin"]) as never,
      { categories: ["customers_orders"], confirmName: "CodeKraft" },
      deps(created),
    );
    expect(r.approvalRequestId).toBe("appr-1");
    expect(created[0]).toContain("finance");
  });
});

describe("approval engine + text", () => {
  it("requester cannot approve their own reset", async () => {
    const { DefaultApprovalsService } = await import("@/modules/approvals/service");
    const svc = new DefaultApprovalsService();
    const tx = {
      select: () => ({
        from: () => ({
          where: () => ({
            for: async () => [
              { id: "r1", requestedBy: "u1", status: "pending", type: "site.reset" },
            ],
          }),
        }),
      }),
    };
    await expect(svc.decide("r1", "u1", "approve", undefined, tx as never)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("describes the reset in plain language", () => {
    expect(describeApproval("site.reset", { categories: ["leads", "quotes"] })).toBe(
      "Reset site data: leads, quotes",
    );
  });
});
