import { describe, expect, it, vi } from "vitest";
import type { TxCtx } from "@/lib/db";

vi.mock("@/modules/approvals/approver-set", () => ({
  computeApproverSet: async () => ["admin-b", "admin-c"],
  countActiveAdmins: async () => 3,
}));
vi.mock("@/modules/audit/service", () => ({ auditService: { log: async () => undefined } }));

import { DefaultApprovalsService } from "@/modules/approvals/service";

const REQUEST_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "22222222-2222-4222-8222-222222222222";

/** Records every `insert(table).values(rows)`; `select` always yields one row. */
function fakeTx() {
  const inserts: { rows: unknown[] }[] = [];
  const tx = {
    insert: () => ({
      values: (rows: unknown) => {
        inserts.push({ rows: Array.isArray(rows) ? rows : [rows] });
        const p = Promise.resolve(undefined) as Promise<undefined> & {
          returning: () => Promise<{ id: string }[]>;
        };
        p.returning = async () => [{ id: REQUEST_ID }];
        return p;
      },
    }),
    select: () => ({
      from: () => ({ where: async () => [{ name: "Asha", email: "a@example.com" }] }),
    }),
  };
  return { tx: tx as unknown as TxCtx, inserts };
}

describe("approvals.request -> approval.requested notification", () => {
  it("notifies every deciding admin in-app with a deep link to the request", async () => {
    const { tx, inserts } = fakeTx();
    const svc = new DefaultApprovalsService();
    const r = await svc.request(
      "product.archive",
      { type: "product", id: PRODUCT_ID },
      { productId: PRODUCT_ID, reason: "stale" },
      "admin-a",
      tx,
    );
    expect(r.approvalRequestId).toBe(REQUEST_ID);
    const rows = inserts.flatMap((i) => i.rows) as Record<string, unknown>[];
    const notes = rows.filter((x) => x.type === "approval.requested");
    expect(notes.map((n) => n.userId).sort()).toEqual(["admin-b", "admin-c"]);
    expect(notes.every((n) => n.link === `/admin/approvals?id=${REQUEST_ID}`)).toBe(true);
    expect(notes.every((n) => n.userId !== "admin-a")).toBe(true);
  });
});
