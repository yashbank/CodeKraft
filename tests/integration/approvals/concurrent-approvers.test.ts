import { beforeAll, describe, expect, it } from "vitest";
import { withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createUser } from "../../factories/users";

describe("approvals concurrency (BR-13, MASTER_SPEC §4.5)", () => {
  const sql = getTestDb();
  let applyCount = 0;

  beforeAll(async () => {
    await migrateTestDb();
    approvalsService.registerApplyHandler("ledger.adjustment", async () => {
      applyCount += 1;
    });
  });

  async function setup() {
    await truncateAll(sql);
    applyCount = 0;
    const requester = await createUser({ role: "super_admin" });
    const a1 = await createUser({ role: "admin" });
    const a2 = await createUser({ role: "admin" });
    const ctx = (id: string, role: "admin" | "super_admin") =>
      buildContext({ user: { id }, session: { id: `s-${id}` }, roles: [role] });
    const { approvalRequestId } = await withTx((tx) =>
      approvalsService.request(
        "ledger.adjustment",
        { type: "ledger", id: "00000000-0000-0000-0000-000000000010" },
        {
          lines: [{ partyType: "company", amountMinor: 5000, currency: "INR", memo: "x" }],
          reason: "Concurrency check",
        },
        requester.id,
        tx,
      ),
    );
    return {
      id: approvalRequestId,
      requesterCtx: ctx(requester.id, "super_admin"),
      c1: ctx(a1.id, "admin"),
      c2: ctx(a2.id, "admin"),
    };
  }

  const state = async (id: string) => {
    const [r] = await sql<{ status: string; applied_at: Date | null }[]>`
      select status, applied_at from approval_requests where id = ${id}`;
    const [cnt] = await sql<{ n: number }[]>`
      select count(*)::int as n from approval_decisions where request_id = ${id}`;
    return { ...r!, decisions: cnt!.n };
  };

  it("A: both approvers approve at once -> applied exactly once", async () => {
    const { id, c1, c2 } = await setup();
    const results = await Promise.all([
      approvalsService.approveRequest(c1, { approvalRequestId: id }),
      approvalsService.approveRequest(c2, { approvalRequestId: id }),
    ]);
    expect(results.filter((r) => r.applied)).toHaveLength(1);
    expect(applyCount).toBe(1);
    const s = await state(id);
    expect(s.status).toBe("applied");
    expect(s.applied_at).not.toBeNull();
    expect(s.decisions).toBe(2);
  });

  it("B: approve vs cancel race ends in exactly one terminal state", async () => {
    const { id, c1, c2, requesterCtx } = await setup();
    // c1 approves first so c2's approval is the completing one racing the cancel.
    await approvalsService.approveRequest(c1, { approvalRequestId: id });
    const [ap, ca] = await Promise.allSettled([
      approvalsService.approveRequest(c2, { approvalRequestId: id }),
      approvalsService.cancelRequest(requesterCtx, { approvalRequestId: id }),
    ]);
    const s = await state(id);
    if (s.status === "applied") {
      expect(ap.status).toBe("fulfilled");
      expect(ca.status).toBe("rejected");
      expect((ca as PromiseRejectedResult).reason).toMatchObject({ code: "STATE_INVALID" });
      expect(applyCount).toBe(1);
    } else {
      expect(s.status).toBe("cancelled");
      expect(ca.status).toBe("fulfilled");
      expect(ap.status).toBe("rejected");
      expect(applyCount).toBe(0);
      expect(s.applied_at).toBeNull();
    }
  });

  it("C: same approver double-approves concurrently -> one decision row", async () => {
    const { id, c1 } = await setup();
    const results = await Promise.allSettled([
      approvalsService.approveRequest(c1, { approvalRequestId: id }),
      approvalsService.approveRequest(c1, { approvalRequestId: id }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled").length).toBeGreaterThanOrEqual(1);
    const s = await state(id);
    expect(s.decisions).toBe(1);
    expect(s.status).toBe("pending");
    expect(applyCount).toBe(0);
  });
});
