import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { buildContext } from "@/lib/authz/context";
import { approvalsService } from "@/modules/approvals/service";
import { ownershipService } from "@/modules/ownership/service";
import { catalogService } from "@/modules/catalog/service";
import { db } from "@/lib/db";
import { productOwnerships } from "../../../drizzle/schema/ownership";
import { allocations } from "../../../drizzle/schema/finance";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createAdmin, createPartner, createUser } from "../../factories/users";
import { createOrder } from "../../factories/commerce";
import { createOwnership } from "../../factories/ownership";
import { createOffering } from "../../factories/offerings";

describe("ownership supersede maintains allocation immutability (BR-05, P3.8)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("leaves existing allocation rows untouched when a new version supersedes the old", async () => {
    await truncateAll();

    const requester = await createAdmin();
    const approver = await createAdmin();

    const requesterCtx = buildContext({
      user: { id: requester.id },
      session: { id: "sess-req-br5" },
      roles: ["admin"],
    });

    const approverCtx = buildContext({
      user: { id: approver.id },
      session: { id: "sess-appr-br5" },
      roles: ["admin"],
    });

    // 1. Create a product first (before partner row so no pending ownership auto-created)
    const product = await catalogService.createProduct(requesterCtx, {
      name: "Allocation Test Product",
      slug: "allocation-test-product",
      shortDescription: "Product to test allocation immutability",
    });

    // 2. Associate partner profiles for requester and approver
    const partner1 = await createPartner({ userId: requester.id });
    const partner2 = await createPartner({ userId: approver.id });

    // 3. Create initial active v1 ownership
    const v1 = await createOwnership({
      productId: product.productId,
      version: 1,
      status: "active",
      companyCutBps: 0,
      createdBy: requester.id,
      lines: [{ partnerId: partner1.id, shareBps: 10000 }],
    });
    expect(v1).toBeDefined();

    // 4. Create offering attached to existing product and order for a customer user (no new admins created)
    const customer = await createUser({ emailVerified: true });
    const offering = await createOffering({ productId: product.productId });
    const order = await createOrder({ offering, user: customer });
    const orderItemId = order.items[0]!.id;

    const [initialAllocation] = await db
      .insert(allocations)
      .values({
        orderItemId,
        ownershipId: v1.id,
        companyCutBps: 2000,
        distributableMinor: 8000,
        companyMinor: 2000,
        lines: [
          {
            partner_id: partner1.id,
            share_bps: 10000,
            amount_minor: 6000,
          },
        ],
        currency: "INR",
        amountInrMinor: 8000,
      })
      .returning();

    expect(initialAllocation).toBeDefined();
    expect(initialAllocation!.id).toBeDefined();

    // 5. Propose v2 ownership with different split (lines sum to 10,000 bps)
    const proposeRes = await ownershipService.proposeOwnership(requesterCtx, {
      productId: product.productId,
      companyCutBps: 3000,
      lines: [
        { partnerId: partner1.id, shareBps: 7000 },
        { partnerId: partner2.id, shareBps: 3000 },
      ],
    });

    // 6. Approve v2 ownership
    const approvalResult = await approvalsService.approveRequest(approverCtx, {
      approvalRequestId: proposeRes.approvalRequestId,
      comment: "Approved v2 split",
    });

    expect(approvalResult.status).toBe("applied");

    // 7. Verify v1 is now superseded
    const [v1After] = await db
      .select()
      .from(productOwnerships)
      .where(eq(productOwnerships.id, v1.id));
    expect(v1After).toBeDefined();
    expect(v1After!.status).toBe("superseded");

    // 8. Verify existing allocation row is 100% untouched (BR-05)
    const [allocationAfter] = await db
      .select()
      .from(allocations)
      .where(eq(allocations.id, initialAllocation!.id));

    expect(allocationAfter).toBeDefined();
    expect(allocationAfter!.ownershipId).toBe(v1.id);
    expect(allocationAfter!.companyCutBps).toBe(2000);
    expect(allocationAfter!.distributableMinor).toBe(8000);
    expect(allocationAfter!.companyMinor).toBe(2000);
    expect(allocationAfter!.lines).toEqual(initialAllocation!.lines);
  });
});
