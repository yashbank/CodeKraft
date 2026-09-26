import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { type TxCtx, getDb, withTx } from "@/lib/db";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { AppError, ErrorCode } from "@/lib/errors";
import { encrypt } from "@/lib/crypto";
import { auditService } from "@/modules/audit/service";
import {
  deliveryTasks,
  entitlements,
  serviceProgress,
} from "../../../drizzle/schema/delivery";
import { orders, orderItems } from "../../../drizzle/schema/commerce";
import { products } from "../../../drizzle/schema/catalog";
import { offerings } from "../../../drizzle/schema/offerings";
import { users } from "../../../drizzle/schema/auth";
import type { DeliveryService } from "./contracts";
import { defaultDeliveryHandlerRegistry } from "./handlers";
import {
  type AssignDeliveryTaskInput,
  type CompleteDeliveryTaskInput,
  type CompleteProvisioningInput,
  type DeliveryTaskRow,
  type ListDeliveryTasksInput,
  type MarkServiceStepInput,
  type MarkServiceStepResult,
  type SetLicenseKeyInput,
  assignDeliveryTaskSchema,
  completeDeliveryTaskSchema,
  completeProvisioningSchema,
  listDeliveryTasksSchema,
  markServiceStepSchema,
  setLicenseKeySchema,
} from "./types";
import type { EntitlementAdminRow } from "@/modules/entitlements/types";

export class DefaultDeliveryService implements DeliveryService {
  constructor(private readonly registry = defaultDeliveryHandlerRegistry) {}

  async completeProvisioning(
    ctx: RequestContext,
    rawInput: CompleteProvisioningInput,
  ): Promise<EntitlementAdminRow> {
    assertPermission(ctx, "delivery.tasks.write");
    const input = completeProvisioningSchema.parse(rawInput);

    return await withTx(async (tx) => {
      const [entitlement] = await tx
        .select()
        .from(entitlements)
        .where(eq(entitlements.id, input.entitlementId))
        .for("update");

      if (!entitlement) {
        throw new AppError(ErrorCode.NOT_FOUND, "Entitlement not found");
      }

      if (entitlement.provisioningState !== "pending") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Cannot complete provisioning when provisioning_state is '${entitlement.provisioningState}'`,
        );
      }

      // Hosted transitions from pending -> active on provisioning complete
      const newStatus =
        entitlement.deliveryType === "hosted" && entitlement.status === "pending"
          ? "active"
          : entitlement.status;

      const [updated] = await tx
        .update(entitlements)
        .set({
          provisioningState: "done",
          provisioningNotes: input.notes,
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(entitlements.id, entitlement.id))
        .returning();

      // Close open provision task
      await tx
        .update(deliveryTasks)
        .set({
          status: "done",
          doneAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(deliveryTasks.entitlementId, entitlement.id),
            eq(deliveryTasks.kind, "provision"),
            eq(deliveryTasks.status, "open"),
          ),
        );

      await auditService.log(
        ctx,
        "entitlement.provisioned",
        { type: "entitlement", id: entitlement.id },
        { provisioningState: entitlement.provisioningState, status: entitlement.status },
        { provisioningState: updated!.provisioningState, status: updated!.status },
        tx,
      );

      // Re-evaluate order fulfilment if linked to an order
      if (entitlement.orderItemId) {
        const [oi] = await tx
          .select({ orderId: orderItems.orderId })
          .from(orderItems)
          .where(eq(orderItems.id, entitlement.orderItemId));
        if (oi?.orderId) {
          await this.evaluateOrderFulfilment(oi.orderId, tx);
        }
      }

      return await this.buildAdminRow(updated!, tx);
    });
  }

  async setLicenseKey(
    ctx: RequestContext,
    rawInput: SetLicenseKeyInput,
  ): Promise<EntitlementAdminRow> {
    assertPermission(ctx, "delivery.tasks.write");
    const input = setLicenseKeySchema.parse(rawInput);

    return await withTx(async (tx) => {
      const [entitlement] = await tx
        .select()
        .from(entitlements)
        .where(eq(entitlements.id, input.entitlementId))
        .for("update");

      if (!entitlement) {
        throw new AppError(ErrorCode.NOT_FOUND, "Entitlement not found");
      }

      if (entitlement.status === "revoked") {
        throw new AppError(ErrorCode.STATE_INVALID, "Cannot set license key on revoked entitlement");
      }

      const encryptedKey = encrypt(input.licenseKey);

      const [updated] = await tx
        .update(entitlements)
        .set({
          licenseKeyEnc: encryptedKey,
          provisioningState: "done",
          updatedAt: new Date(),
        })
        .where(eq(entitlements.id, entitlement.id))
        .returning();

      // Close open provision task
      await tx
        .update(deliveryTasks)
        .set({
          status: "done",
          doneAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(deliveryTasks.entitlementId, entitlement.id),
            eq(deliveryTasks.kind, "provision"),
            eq(deliveryTasks.status, "open"),
          ),
        );

      await auditService.log(
        ctx,
        "license.set",
        { type: "entitlement", id: entitlement.id },
        null,
        { keySet: true },
        tx,
      );

      if (entitlement.orderItemId) {
        const [oi] = await tx
          .select({ orderId: orderItems.orderId })
          .from(orderItems)
          .where(eq(orderItems.id, entitlement.orderItemId));
        if (oi?.orderId) {
          await this.evaluateOrderFulfilment(oi.orderId, tx);
        }
      }

      return await this.buildAdminRow(updated!, tx);
    });
  }

  async markServiceStep(
    ctx: RequestContext,
    rawInput: MarkServiceStepInput,
  ): Promise<MarkServiceStepResult> {
    assertPermission(ctx, "delivery.tasks.write");
    const input = markServiceStepSchema.parse(rawInput);

    return await withTx(async (tx) => {
      const [step] = await tx
        .select()
        .from(serviceProgress)
        .where(
          and(
            eq(serviceProgress.entitlementId, input.entitlementId),
            eq(serviceProgress.stepKey, input.stepKey),
          ),
        )
        .for("update");

      if (!step) {
        throw new AppError(ErrorCode.NOT_FOUND, `Service step '${input.stepKey}' not found`);
      }

      const now = new Date();
      await tx
        .update(serviceProgress)
        .set({
          doneAt: input.done ? now : null,
          doneBy: input.done ? ctx.userId : null,
          note: input.note ?? null,
          updatedAt: now,
        })
        .where(eq(serviceProgress.id, step.id));

      const allSteps = await tx
        .select()
        .from(serviceProgress)
        .where(eq(serviceProgress.entitlementId, input.entitlementId));

      const allDone = allSteps.length > 0 && allSteps.every((s) => s.doneAt !== null);

      const [entitlement] = await tx
        .select()
        .from(entitlements)
        .where(eq(entitlements.id, input.entitlementId));

      if (entitlement?.orderItemId) {
        const [oi] = await tx
          .select({ orderId: orderItems.orderId })
          .from(orderItems)
          .where(eq(orderItems.id, entitlement.orderItemId));
        if (oi?.orderId) {
          await this.evaluateOrderFulfilment(oi.orderId, tx);
        }
      }

      await auditService.log(
        ctx,
        "service_step.marked",
        { type: "entitlement", id: input.entitlementId },
        { stepKey: input.stepKey, done: step.doneAt !== null },
        { stepKey: input.stepKey, done: input.done },
        tx,
      );

      return {
        progress: allSteps.map((s) => ({
          key: s.stepKey,
          title: s.stepKey,
          doneAt: s.doneAt ? s.doneAt.toISOString() : null,
          note: s.note,
        })),
        allDone,
      };
    });
  }

  async listDeliveryTasks(
    ctx: RequestContext,
    rawInput: ListDeliveryTasksInput,
  ): Promise<{ items: DeliveryTaskRow[]; nextCursor: string | null }> {
    assertPermission(ctx, "delivery.tasks.write");
    const input = listDeliveryTasksSchema.parse(rawInput);
    const db = await getDb();

    const conditions = [];
    if (input.filters.kind) {
      conditions.push(eq(deliveryTasks.kind, input.filters.kind));
    }
    if (input.filters.status) {
      conditions.push(eq(deliveryTasks.status, input.filters.status));
    }
    if (input.filters.assignedTo) {
      const targetUser = input.filters.assignedTo === "me" ? ctx.userId : input.filters.assignedTo;
      if (targetUser) {
        conditions.push(eq(deliveryTasks.assignedTo, targetUser));
      }
    }

    const rows = await db
      .select({
        task: deliveryTasks,
        entitlement: entitlements,
        product: products,
        customer: users,
      })
      .from(deliveryTasks)
      .innerJoin(entitlements, eq(deliveryTasks.entitlementId, entitlements.id))
      .innerJoin(products, eq(entitlements.productId, products.id))
      .innerJoin(users, eq(entitlements.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(deliveryTasks.createdAt))
      .limit(input.limit + 1);

    const hasNext = rows.length > input.limit;
    const items = (hasNext ? rows.slice(0, input.limit) : rows).map((r) => ({
      taskId: r.task.id,
      kind: r.task.kind,
      status: r.task.status,
      entitlementId: r.task.entitlementId,
      product: { id: r.product.id, name: r.product.name },
      customer: { id: r.customer.id, email: r.customer.email, name: r.customer.name },
      assignedTo: r.task.assignedTo ? { id: r.task.assignedTo, name: null } : null,
      note: r.task.note,
      createdAt: r.task.createdAt.toISOString(),
      doneAt: r.task.doneAt ? r.task.doneAt.toISOString() : null,
    }));

    return {
      items,
      nextCursor: hasNext ? items[items.length - 1]?.taskId ?? null : null,
    };
  }

  async completeDeliveryTask(
    ctx: RequestContext,
    rawInput: CompleteDeliveryTaskInput,
  ): Promise<DeliveryTaskRow> {
    assertPermission(ctx, "delivery.tasks.write");
    const input = completeDeliveryTaskSchema.parse(rawInput);

    return await withTx(async (tx) => {
      const [task] = await tx
        .select()
        .from(deliveryTasks)
        .where(eq(deliveryTasks.id, input.taskId))
        .for("update");

      if (!task) {
        throw new AppError(ErrorCode.NOT_FOUND, "Delivery task not found");
      }

      if (task.status === "done") {
        throw new AppError(ErrorCode.STATE_INVALID, "Delivery task is already completed");
      }

      const now = new Date();
      const [updatedTask] = await tx
        .update(deliveryTasks)
        .set({
          status: "done",
          doneAt: now,
          note: input.note ?? task.note,
          updatedAt: now,
        })
        .where(eq(deliveryTasks.id, task.id))
        .returning();

      // If revoke_external completed, ensure entitlement is marked revoked
      if (task.kind === "revoke_external") {
        await tx
          .update(entitlements)
          .set({
            status: "revoked",
            revokedAt: now,
            updatedAt: now,
          })
          .where(eq(entitlements.id, task.entitlementId));
      }

      await auditService.log(
        ctx,
        "delivery_task.completed",
        { type: "delivery_task", id: task.id },
        { status: task.status },
        { status: updatedTask!.status },
        tx,
      );

      const [ent] = await tx
        .select()
        .from(entitlements)
        .where(eq(entitlements.id, task.entitlementId));
      const [prod] = await tx
        .select()
        .from(products)
        .where(eq(products.id, ent!.productId));
      const [cust] = await tx
        .select()
        .from(users)
        .where(eq(users.id, ent!.userId));

      return {
        taskId: updatedTask!.id,
        kind: updatedTask!.kind,
        status: updatedTask!.status,
        entitlementId: updatedTask!.entitlementId,
        product: { id: prod!.id, name: prod!.name },
        customer: { id: cust!.id, email: cust!.email, name: cust!.name },
        assignedTo: updatedTask!.assignedTo ? { id: updatedTask!.assignedTo, name: null } : null,
        note: updatedTask!.note,
        createdAt: updatedTask!.createdAt.toISOString(),
        doneAt: updatedTask!.doneAt ? updatedTask!.doneAt.toISOString() : null,
      };
    });
  }

  async assignDeliveryTask(
    ctx: RequestContext,
    rawInput: AssignDeliveryTaskInput,
  ): Promise<DeliveryTaskRow> {
    assertPermission(ctx, "delivery.tasks.write");
    const input = assignDeliveryTaskSchema.parse(rawInput);

    return await withTx(async (tx) => {
      const [task] = await tx
        .select()
        .from(deliveryTasks)
        .where(eq(deliveryTasks.id, input.taskId))
        .for("update");

      if (!task) {
        throw new AppError(ErrorCode.NOT_FOUND, "Delivery task not found");
      }

      const [updatedTask] = await tx
        .update(deliveryTasks)
        .set({
          assignedTo: input.assignedTo,
          updatedAt: new Date(),
        })
        .where(eq(deliveryTasks.id, task.id))
        .returning();

      const [ent] = await tx
        .select()
        .from(entitlements)
        .where(eq(entitlements.id, task.entitlementId));
      const [prod] = await tx
        .select()
        .from(products)
        .where(eq(products.id, ent!.productId));
      const [cust] = await tx
        .select()
        .from(users)
        .where(eq(users.id, ent!.userId));

      return {
        taskId: updatedTask!.id,
        kind: updatedTask!.kind,
        status: updatedTask!.status,
        entitlementId: updatedTask!.entitlementId,
        product: { id: prod!.id, name: prod!.name },
        customer: { id: cust!.id, email: cust!.email, name: cust!.name },
        assignedTo: updatedTask!.assignedTo ? { id: updatedTask!.assignedTo, name: null } : null,
        note: updatedTask!.note,
        createdAt: updatedTask!.createdAt.toISOString(),
        doneAt: updatedTask!.doneAt ? updatedTask!.doneAt.toISOString() : null,
      };
    });
  }

  async evaluateOrderFulfilment(orderId: string, tx: TxCtx): Promise<boolean> {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");

    if (!order || order.status === "fulfilled" || order.status === "cancelled") {
      return false;
    }

    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    if (items.length === 0) return false;

    // Load all entitlements for these items
    const itemIds = items.map((i) => i.id);
    const itemEntitlements = await tx
      .select()
      .from(entitlements)
      .where(inArray(entitlements.orderItemId, itemIds));

    // Every item must have an entitlement
    if (itemEntitlements.length !== items.length) {
      return false;
    }

    // Every entitlement's handler must report isFulfilled === true
    for (const ent of itemEntitlements) {
      const handler = this.registry.get(ent.deliveryType);
      const progress = await tx
        .select()
        .from(serviceProgress)
        .where(eq(serviceProgress.entitlementId, ent.id));

      if (!handler.isFulfilled(ent, progress)) {
        return false;
      }
    }

    // All fulfilled!
    const now = new Date();
    await tx
      .update(orders)
      .set({
        status: "fulfilled",
        fulfilledAt: now,
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));

    return true;
  }

  private async buildAdminRow(ent: typeof entitlements.$inferSelect, tx: TxCtx): Promise<EntitlementAdminRow> {
    const [user] = await tx.select().from(users).where(eq(users.id, ent.userId));
    const [prod] = await tx.select().from(products).where(eq(products.id, ent.productId));
    const [offering] = await tx.select().from(offerings).where(eq(offerings.id, ent.offeringId));

    const openTasks = await tx
      .select()
      .from(deliveryTasks)
      .where(and(eq(deliveryTasks.entitlementId, ent.id), eq(deliveryTasks.status, "open")));

    let orderNo: string | null = null;
    if (ent.orderItemId) {
      const [item] = await tx.select().from(orderItems).where(eq(orderItems.id, ent.orderItemId));
      if (item) {
        const [ord] = await tx.select().from(orders).where(eq(orders.id, item.orderId));
        orderNo = ord?.orderNo ?? null;
      }
    }

    const handler = this.registry.get(ent.deliveryType);
    const actions = handler.adminActions(ent, openTasks);

    return {
      entitlementId: ent.id,
      user: { id: user!.id, email: user!.email, name: user!.name },
      product: { id: prod!.id, name: prod!.name },
      offering: { id: offering!.id, name: offering!.name },
      deliveryType: ent.deliveryType,
      status: ent.status,
      provisioningState: ent.provisioningState,
      accessEndsAt: ent.accessEndsAt ? ent.accessEndsAt.toISOString() : null,
      downloads: { used: ent.downloadsUsed, cap: ent.downloadCap },
      licenseKeyIssued: Boolean(ent.licenseKeyEnc),
      orderNo,
      grantedManuallyBy: ent.grantedManuallyBy,
      openTasks: openTasks.length,
      adminActions: actions,
      createdAt: ent.createdAt.toISOString(),
    };
  }
}

import { createNotImplemented } from "@/modules/_shared/not-implemented";

export const deliveryService = new DefaultDeliveryService();

export function createNotImplementedDeliveryService(): DeliveryService {
  return createNotImplemented<DeliveryService>("delivery", "P5", {
    completeProvisioning: "async",
    setLicenseKey: "async",
    markServiceStep: "async",
    listDeliveryTasks: "async",
    completeDeliveryTask: "async",
    assignDeliveryTask: "async",
    handlers: "sync",
  });
}
