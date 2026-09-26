import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { deliveryService } from "@/modules/delivery/service";
import { deliveryTasks, entitlements, serviceProgress } from "../../../drizzle/schema/delivery";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createEntitlement } from "../../factories/delivery";
import { buildContext } from "@/lib/authz/context";

describe("Delivery Tasks & Service Progress (API-DEL-07..10, D-601, D-608)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("handles completeProvisioning and closes open provision task", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const product = await createProduct({ createdBy: admin.id });
    const offering = await createOffering({
      productId: product.id,
      deliveryType: "saas",
    });
    const buyer = await createUser({ emailVerified: true });

    const ent = await createEntitlement({
      offering,
      userId: buyer.id,
      deliveryType: "saas",
      status: "active",
      provisioningState: "pending",
    });

    const [task] = await db
      .insert(deliveryTasks)
      .values({
        entitlementId: ent.id,
        kind: "provision",
        status: "open",
      })
      .returning();

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    await deliveryService.completeProvisioning(adminCtx, {
      entitlementId: ent.id,
      notes: {
        loginUrl: "https://cloud.codekraft.dev/login",
        username: "user_vip_01",
        message: "Your cluster is ready",
      },
      credentialsEmail: true,
    });

    const [taskAfter] = await db.select().from(deliveryTasks).where(eq(deliveryTasks.id, task!.id));
    expect(taskAfter?.status).toBe("done");

    const [entAfter] = await db.select().from(entitlements).where(eq(entitlements.id, ent.id));
    expect(entAfter?.provisioningState).toBe("done");
  });

  it("marks service step and tracks completion", async () => {
    await truncateAll();

    const admin = await createAdmin();
    const product = await createProduct({ createdBy: admin.id });
    const offering = await createOffering({
      productId: product.id,
      deliveryType: "service",
    });
    const buyer = await createUser({ emailVerified: true });

    const ent = await createEntitlement({
      offering,
      userId: buyer.id,
      deliveryType: "service",
      status: "active",
    });

    await db.insert(serviceProgress).values([
      { entitlementId: ent.id, stepKey: "kickoff", doneAt: null },
      { entitlementId: ent.id, stepKey: "implementation", doneAt: null },
    ]);

    const adminCtx = buildContext({
      user: { id: admin.id },
      session: { id: "sess-admin" },
      roles: ["super_admin"],
    });

    // Mark step 1 done
    const res1 = await deliveryService.markServiceStep(adminCtx, {
      entitlementId: ent.id,
      stepKey: "kickoff",
      done: true,
      note: "Kickoff call held on Zoom",
    });
    expect(res1.allDone).toBe(false);

    // Mark step 2 done
    const res2 = await deliveryService.markServiceStep(adminCtx, {
      entitlementId: ent.id,
      stepKey: "implementation",
      done: true,
      note: "All code deployed to production",
    });
    expect(res2.allDone).toBe(true);
  });
});
