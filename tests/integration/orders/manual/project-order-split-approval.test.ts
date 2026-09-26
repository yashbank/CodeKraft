import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { ordersService } from "@/modules/orders/service";
import { approvalsService } from "@/modules/approvals/service";
import { orders } from "../../../../drizzle/schema/commerce";
import { approvalRequests } from "../../../../drizzle/schema/approvals";
import { migrateTestDb } from "../../../setup/migrate";
import { truncateAll } from "../../../setup/db";
import { createAdmin, createPartner } from "../../../factories/users";
import { buildContext } from "@/lib/authz/context";

describe("Project order split approval lifecycle (API-COM-07, API-COM-14, BR-05, MASTER_SPEC §7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("creates approval request on project order with manual split and updates order when approved", async () => {
    await truncateAll();

    const admin1 = await createAdmin();
    const admin2 = await createAdmin();
    const partner1 = await createPartner({ userId: admin1.id });
    const partner2 = await createPartner({ userId: admin2.id });

    const admin1Ctx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-admin-1" },
      roles: ["admin"],
    });

    const admin2Ctx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-admin-2" },
      roles: ["admin"],
    });

    // 1. Admin 1 creates project order with manual split
    const res = await ordersService.createManualOrder(admin1Ctx, {
      type: "project",
      customer: {
        clientName: "Enterprise Client",
        clientEmail: "billing@client.com",
        clientCompany: "Client Corp",
      },
      currency: "INR",
      items: [
        {
          description: "Phase 1 Architecture & Design",
          unitMinor: 100000,
          quantity: 1,
          splitSnapshot: {
            companyCutBps: 1000,
            lines: [
              { partnerId: partner1.id, shareBps: 6000 },
              { partnerId: partner2.id, shareBps: 4000 },
            ],
          },
        },
      ],
      taxEnabled: false,
      billing: {
        name: "Enterprise Client",
        email: "billing@client.com",
        country: "IN",
      },
    });

    expect(res.orderId).toBeDefined();
    expect(res.approvalRequestId).toBeDefined();

    // 2. Order exists in pending_payment with splitApprovalRequestId null
    const [initialOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, res.orderId));
    expect(initialOrder?.status).toBe("pending_payment");
    expect(initialOrder?.splitApprovalRequestId).toBeNull();

    // 3. Approval request is created in pending state
    const [req] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, res.approvalRequestId!));
    expect(req?.type).toBe("project_order.split");
    expect(req?.status).toBe("pending");
    expect(req?.requestedBy).toBe(admin1.id);
    expect(req?.payload).toEqual({ orderId: res.orderId });

    // 4. Admin 2 (second admin) approves
    const decideRes = await withTx(async (tx) => {
      return await approvalsService.decide(
        res.approvalRequestId!,
        admin2.id,
        "approve",
        "Looks good to me",
        tx,
      );
    });
    expect(decideRes.status).toBe("applied");

    // 5. Order is updated with splitApprovalRequestId
    const [updatedOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, res.orderId));
    expect(updatedOrder?.splitApprovalRequestId).toBe(res.approvalRequestId);
  });
});
