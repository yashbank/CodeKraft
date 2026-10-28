/**
 * Admin fulfilment of paid orders for every delivery type + admin-created delivery tasks.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { entitlementsService } from "@/modules/entitlements/service";
import { deliveryService } from "@/modules/delivery/service";
import { deliveryTasks, entitlements } from "../../../drizzle/schema/delivery";
import { notifications } from "../../../drizzle/schema/notifications";
import { orders } from "../../../drizzle/schema/commerce";
import { migrateTestDb } from "../../setup/migrate";
import { truncateAll } from "../../setup/db";
import { createAdmin, createUser } from "../../factories/users";
import { createProduct } from "../../factories/catalog";
import { createOffering } from "../../factories/offerings";
import { createOrder } from "../../factories/commerce";
import { buildContext } from "@/lib/authz/context";

async function seed(deliveryType: "saas" | "hosted" | "download" | "service" | "custom") {
  const admin = await createAdmin();
  const buyer = await createUser({ emailVerified: true });
  const product = await createProduct({ createdBy: admin.id });
  const offering = await createOffering({ productId: product.id, deliveryType });
  const order = await createOrder({ offering, user: buyer, status: "paid" });
  const [ent] = await withTx(async (tx) => entitlementsService.grantForOrder(order.id, tx));
  const ctx = buildContext({
    user: { id: admin.id },
    session: { id: "s-admin" },
    roles: ["super_admin"],
  });
  return { admin, buyer, order, entId: ent!.entitlementId, ctx };
}

const orderStatus = async (id: string) =>
  (await db.select().from(orders).where(eq(orders.id, id)))[0]?.status;

describe("admin fulfilment per delivery type", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  for (const type of ["saas", "hosted", "custom", "download"] as const) {
    it(`markDelivered fulfils a paid ${type} order and notifies the customer`, async () => {
      await truncateAll();
      const s = await seed(type);
      // Worst case: item still awaiting the admin.
      await db
        .update(entitlements)
        .set({
          status: "pending",
          ...(type === "custom" || type === "download" ? {} : { provisioningState: "pending" }),
        })
        .where(eq(entitlements.id, s.entId));
      await db.update(orders).set({ status: "paid" }).where(eq(orders.id, s.order.id));

      const row = await deliveryService.markDelivered(s.ctx, {
        entitlementId: s.entId,
        note: "All set",
        link: "https://example.com/handover",
      });
      expect(row.status).toBe("active");
      expect(row.provisioningState === "done" || row.provisioningState === "n/a").toBe(true);
      expect(await orderStatus(s.order.id)).toBe("fulfilled");

      const [ent] = await db.select().from(entitlements).where(eq(entitlements.id, s.entId));
      expect(ent?.provisioningNotes).toMatchObject({
        message: "All set",
        loginUrl: "https://example.com/handover",
      });
      const open = await db
        .select()
        .from(deliveryTasks)
        .where(and(eq(deliveryTasks.entitlementId, s.entId), eq(deliveryTasks.status, "open")));
      expect(open).toHaveLength(0);
      const notes = await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, s.buyer.id));
      expect(notes.length).toBeGreaterThan(0);
    });
  }

  it("markDelivered rejects revoked entitlements", async () => {
    await truncateAll();
    const s = await seed("custom");
    await db.update(entitlements).set({ status: "revoked" }).where(eq(entitlements.id, s.entId));
    await expect(
      deliveryService.markDelivered(s.ctx, { entitlementId: s.entId }),
    ).rejects.toMatchObject({ code: "STATE_INVALID" });
  });
});

describe("admin-created delivery tasks", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("creates, maps to order/customer, lists by order, assigns, completes and fulfils", async () => {
    await truncateAll();
    const s = await seed("custom");
    // custom auto-activates; make the order wait on the admin again.
    await db.update(entitlements).set({ status: "pending" }).where(eq(entitlements.id, s.entId));
    await db.update(orders).set({ status: "paid" }).where(eq(orders.id, s.order.id));

    const task = await deliveryService.createDeliveryTask(s.ctx, {
      entitlementId: s.entId,
      kind: "provision",
      assignedTo: s.admin.id,
      note: "Build the thing",
    });
    expect(task.order?.id).toBe(s.order.id);
    expect(task.customer.id).toBe(s.buyer.id);
    expect(task.assignedTo?.id).toBe(s.admin.id);

    await expect(
      deliveryService.createDeliveryTask(s.ctx, { entitlementId: s.entId, kind: "provision" }),
    ).rejects.toMatchObject({ code: "STATE_INVALID" });

    const listed = await deliveryService.listDeliveryTasks(s.ctx, {
      limit: 20,
      filters: { orderId: s.order.id },
    } as never);
    expect(listed.items.map((t) => t.taskId)).toEqual([task.taskId]);
    const other = await deliveryService.listDeliveryTasks(s.ctx, {
      limit: 20,
      filters: { orderId: "00000000-0000-4000-8000-000000000000" },
    } as never);
    expect(other.items).toHaveLength(0);

    const unassigned = await deliveryService.assignDeliveryTask(s.ctx, {
      taskId: task.taskId,
      assignedTo: null,
    });
    expect(unassigned.assignedTo).toBeNull();

    const done = await deliveryService.completeDeliveryTask(s.ctx, {
      taskId: task.taskId,
      note: "Shipped",
    });
    expect(done.status).toBe("done");
    expect(done.entitlementStatus).toBe("active");
    expect(await orderStatus(s.order.id)).toBe("fulfilled");
  });

  it("completing a provision task on a saas order marks it provisioned and fulfils the order", async () => {
    await truncateAll();
    const s = await seed("saas");
    expect(await orderStatus(s.order.id)).toBe("paid");
    const [open] = await db
      .select()
      .from(deliveryTasks)
      .where(and(eq(deliveryTasks.entitlementId, s.entId), eq(deliveryTasks.status, "open")));
    expect(open).toBeDefined();
    await deliveryService.completeDeliveryTask(s.ctx, { taskId: open!.id });
    const [ent] = await db.select().from(entitlements).where(eq(entitlements.id, s.entId));
    expect(ent?.provisioningState).toBe("done");
    expect(await orderStatus(s.order.id)).toBe("fulfilled");
  });

  it("refuses a provision task for a revoked entitlement", async () => {
    await truncateAll();
    const s = await seed("custom");
    await db.update(entitlements).set({ status: "revoked" }).where(eq(entitlements.id, s.entId));
    await expect(
      deliveryService.createDeliveryTask(s.ctx, { entitlementId: s.entId, kind: "provision" }),
    ).rejects.toMatchObject({ code: "STATE_INVALID" });
  });
});
