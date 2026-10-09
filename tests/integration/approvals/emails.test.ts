import { beforeAll, describe, expect, it } from "vitest";
import { withTx } from "@/lib/db";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { getTestDb, truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createUser } from "../../factories/users";

describe("approval emails via outbox", () => {
  const sql = getTestDb();

  beforeAll(async () => {
    await migrateTestDb();
  });

  async function setup() {
    await truncateAll(sql);
    const requester = await createUser({ role: "super_admin" });
    const a1 = await createUser({ role: "admin" });
    const a2 = await createUser({ role: "admin" });
    approvalsService.registerApplyHandler("ledger.adjustment", async () => {});
    approvalsService.registerRejectHandler("ledger.adjustment", async () => {});
    const { approvalRequestId } = await withTx((tx) =>
      approvalsService.request(
        "ledger.adjustment",
        { type: "ledger", id: "00000000-0000-0000-0000-000000000010" },
        {
          lines: [{ partyType: "company", amountMinor: 5000, currency: "INR", memo: "m" }],
          reason: "Correction",
        },
        requester.id,
        tx,
      ),
    );
    const ctx = buildContext({
      user: { id: a1.id },
      session: { id: "s" },
      roles: ["admin"],
    });
    const ctx2 = buildContext({ user: { id: a2.id }, session: { id: "s2" }, roles: ["admin"] });
    return { requester, a1, a2, approvalRequestId, ctx, ctx2 };
  }

  const rows = (template: string) =>
    sql<{ to_email: string; payload: Record<string, unknown> }[]>`
      select to_email, payload from email_outbox where template = ${template}`;

  it("request() emails the 2 non-requester admins; approve emails requester", async () => {
    const { requester, a1, a2, approvalRequestId, ctx, ctx2 } = await setup();
    const needed = await rows("approval-needed");
    expect(needed.map((r) => r.to_email).sort()).toEqual([a1.email, a2.email].sort());
    expect(needed.some((r) => r.to_email === requester.email)).toBe(false);

    await approvalsService.approveRequest(ctx, { approvalRequestId, comment: "ok" });
    await approvalsService.approveRequest(ctx2, { approvalRequestId, comment: "ok" });
    const decided = await rows("approval-decided");
    expect(decided).toHaveLength(1);
    expect(decided[0]!.to_email).toBe(requester.email);
    expect(decided[0]!.payload.outcome).toBe("applied");
  });

  it("reject emails requester with outcome rejected", async () => {
    const { requester, approvalRequestId, ctx } = await setup();
    await approvalsService.rejectRequest(ctx, { approvalRequestId, comment: "no" });
    const decided = await rows("approval-decided");
    expect(decided).toHaveLength(1);
    expect(decided[0]!.to_email).toBe(requester.email);
    expect(decided[0]!.payload.outcome).toBe("rejected");
  });
});
