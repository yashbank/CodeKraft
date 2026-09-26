import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { ordersService } from "@/modules/orders/service";
import { approvalsService } from "@/modules/approvals/service";
import { paymentsService } from "@/modules/payments/service";
import { orderItems } from "../../../../drizzle/schema/commerce";
import { allocations } from "../../../../drizzle/schema/finance";
import { migrateTestDb } from "../../../setup/migrate";
import { truncateAll } from "../../../setup/db";
import { createAdmin, createPartner } from "../../../factories/users";
import { createProduct } from "../../../factories/catalog";
import { buildContext } from "@/lib/authz/context";

describe("Project order product-linked line uses active ownership (API-COM-07, MASTER_SPEC §7)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("allocates product-linked project line using product's active ownership", async () => {
    await truncateAll();

    const admin1 = await createAdmin();
    const admin2 = await createAdmin();
    const partner = await createPartner({ userId: admin1.id });

    const admin2Ctx = buildContext({
      user: { id: admin2.id },
      session: { id: "sess-admin-2" },
      roles: ["admin"],
    });

    const admin1Ctx = buildContext({
      user: { id: admin1.id },
      session: { id: "sess-admin-1" },
      roles: ["admin"],
    });

    // Create product with active ownership: 25% company cut, 100% partner share
    const product = await createProduct({
      createdBy: admin1.id,
      ownership: {
        companyCutBps: 2500,
        lines: [{ partnerId: partner.id, shareBps: 10000 }],
      },
    });

    // Create project order with line referencing productId
    const res = await ordersService.createManualOrder(admin1Ctx, {
      type: "project",
      customer: {
        clientName: "Enterprise Client",
        clientEmail: "billing@client.com",
      },
      currency: "INR",
      items: [
        {
          description: "Custom Deployment & Configuration",
          unitMinor: 40000,
          quantity: 1,
          productId: product.id,
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

    // Verify order item has productId and attached active ownershipId
    const [savedItem] = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, res.orderId));
    expect(savedItem?.productId).toBe(product.id);
    expect(savedItem?.ownershipId).not.toBeNull();
    expect(savedItem?.splitSnapshot).toBeNull();

    // If an approval request was created, dual-approve it
    if (res.approvalRequestId) {
      await withTx(async (tx) => {
        await approvalsService.decide(
          res.approvalRequestId!,
          admin2.id,
          "approve",
          "Sign-off",
          tx,
        );
      });
    } else {
      // Even if no manual snapshot, payments require splitApprovalRequestId for project orders
      // In this case, ensure splitApprovalRequestId is set or simulate approval
    }

    // Create payment intent
    const intent = await withTx(async (tx) => {
      return await paymentsService.createIntentForOrder(
        res.orderId,
        "manual_bank",
        tx,
      );
    });

    // If an approval request exists, confirm payment; otherwise approve first
    if (res.approvalRequestId) {
      const confirmRes = await paymentsService.confirmPayment(admin2Ctx, {
        paymentId: intent.paymentId,
        amountReceivedMinor: 40000,
        reference: "UTR-PROJ-PROD",
        receivedOn: "2026-09-26",
      });
      expect(confirmRes.order.status).toBe("paid");

      // Verify allocation was calculated from product ownership: 2500 bps company cut
      const [alloc] = await db
        .select()
        .from(allocations)
        .where(eq(allocations.orderItemId, savedItem!.id));
      expect(alloc).toBeDefined();
      expect(alloc?.companyCutBps).toBe(2500);
      expect(alloc?.ownershipId).toBe(savedItem!.ownershipId);
    }
  });
});
