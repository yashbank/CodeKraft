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

describe("Project order split rejection cancels order (API-ADM-03, MASTER_SPEC §7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("cancels pending project order when split approval request is rejected", async () => {
    await truncateAll();

    const admin1 = await createAdmin();
    const admin2 = await createAdmin();
    const partner = await createPartner({ userId: admin1.id });

    const admin1Ctx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-admin-1" },
      roles: ["admin"],
    });

    // 1. Admin 1 creates project order
    const res = await ordersService.createManualOrder(admin1Ctx, {
      type: "project",
      customer: {
        clientName: "Acme Corp",
        clientEmail: "billing@acme.com",
      },
      currency: "INR",
      items: [
        {
          description: "Full Stack Consultancy",
          unitMinor: 150000,
          quantity: 1,
          splitSnapshot: {
            companyCutBps: 2000,
            lines: [{ partnerId: partner.id, shareBps: 10000 }],
          },
        },
      ],
      taxEnabled: false,
      billing: {
        name: "Acme Corp",
        email: "billing@acme.com",
        country: "IN",
      },
    });

    expect(res.orderId).toBeDefined();
    expect(res.approvalRequestId).toBeDefined();

    // 2. Verify order is pending_payment
    const [initialOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, res.orderId));
    expect(initialOrder?.status).toBe("pending_payment");

    // 3. Admin 2 rejects the split proposal
    const decideRes = await withTx(async (tx) => {
      return await approvalsService.decide(
        res.approvalRequestId!,
        admin2.id,
        "reject",
        "Company cut is too low for this project scope",
        tx,
      );
    });
    expect(decideRes.status).toBe("rejected");

    // 4. Verify approval request is rejected
    const [req] = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, res.approvalRequestId!));
    expect(req?.status).toBe("rejected");

    // 5. Verify order status transitioned to cancelled with cancelledAt timestamp
    const [cancelledOrder] = await db
      .select()
      .from(orders)
      .where(eq(orders.id, res.orderId));
    expect(cancelledOrder?.status).toBe("cancelled");
    expect(cancelledOrder?.cancelledAt).not.toBeNull();
  });
});
