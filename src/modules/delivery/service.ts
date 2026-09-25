/**
 * `delivery` service — PHASE-05 P5.2 (`evaluateOrderFulfilment`), P5.4 (`setLicenseKey`) and the
 * admin delivery operations of API-DEL-07/09/10 (provisioning, service steps, tasks). Implements
 * the frozen `DeliveryService` contract; admin mutations audit inside the transaction
 * (MASTER_SPEC §4.9) and re-evaluate order fulfilment (MASTER_SPEC §7 "Order fulfilled").
 */
import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import { type TxCtx, withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { users } from "../../../drizzle/schema/auth";
import { products } from "../../../drizzle/schema/catalog";
import { orderItems } from "../../../drizzle/schema/commerce";
import {
  type DeliveryTask,
  deliveryTasks,
  entitlements,
  serviceProgress,
} from "../../../drizzle/schema/delivery";
import {
  type DeliveryPorts,
  entitlementDashboardUrl,
  lazyService,
  resolveDeliveryPorts,
} from "@/modules/entitlements/deps";
import { assertProductInScope, productScopeCondition, resolveProductScope } from "@/modules/entitlements/scope";
import { assertTransition } from "@/modules/entitlements/state";
import type { EntitlementAdminRow } from "@/modules/entitlements/types";
import { type EntitlementBundle, loadEntitlementBundle, toAdminRow } from "@/modules/entitlements/view";
import { entitlementsService } from "@/modules/entitlements/service";
import type { DeliveryService } from "./contracts";
import { evaluateOrderFulfilment } from "./fulfilment";
import { stepsFromOffering } from "./handlers";
import { encryptLicenseKey } from "./license";
import type {
  AssignDeliveryTaskInput,
  CompleteDeliveryTaskInput,
  CompleteProvisioningInput,
  DeliveryTaskRow,
  ListDeliveryTasksInput,
  MarkServiceStepInput,
  SetLicenseKeyInput,
} from "./types";

export type { DeliveryPorts as DeliveryDeps } from "@/modules/entitlements/deps";

function notFound(what = "Entitlement"): AppError {
  return new AppError(ErrorCode.NOT_FOUND, `${what} not found.`);
}

const subjectOf = (entitlementId: string) => ({ type: "entitlement", id: entitlementId });

function taskCursor(cursor: string): { createdAt: string; id: string } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      createdAt?: unknown;
      id?: unknown;
    };
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") throw new Error("bad");
    return { createdAt: parsed.createdAt, id: parsed.id };
  } catch {
    throw new AppError(ErrorCode.VALIDATION, "Invalid cursor.", { fieldErrors: { cursor: ["invalid cursor"] } });
  }
}

export function createDeliveryService(deps: DeliveryPorts): DeliveryService {
  const run = <T>(fn: (tx: TxCtx) => Promise<T>, outer?: TxCtx): Promise<T> => withTx(fn, outer, deps.db);

  const reload = async (tx: TxCtx, id: string): Promise<EntitlementBundle> => {
    const bundle = await loadEntitlementBundle(tx, id);
    if (bundle === null) throw notFound();
    return bundle;
  };

  const loadScoped = async (tx: TxCtx, ctx: RequestContext, id: string): Promise<EntitlementBundle> => {
    const bundle = await reload(tx, id);
    await assertProductInScope(ctx, bundle.entitlement.productId, tx);
    return bundle;
  };

  const closeTasks = async (tx: TxCtx, entitlementId: string, kind: DeliveryTask["kind"], doneBy: string, now: Date) => {
    await tx
      .update(deliveryTasks)
      .set({ status: "done", doneAt: now, assignedTo: doneBy, updatedAt: now })
      .where(
        and(eq(deliveryTasks.entitlementId, entitlementId), eq(deliveryTasks.kind, kind), eq(deliveryTasks.status, "open")),
      );
  };

  /** Order fulfilment after a delivery event; `false` for manual grants (no order). */
  const refulfil = async (tx: TxCtx, bundle: EntitlementBundle): Promise<boolean> =>
    bundle.order === null ? false : evaluateOrderFulfilment(bundle.order.id, tx, deps.handlers, deps.now());

  const adminRow = async (tx: TxCtx, id: string): Promise<EntitlementAdminRow> => toAdminRow(await reload(tx, id), deps.handlers);

  const toTaskRow = (row: {
    task: DeliveryTask;
    productId: string;
    productName: string;
    customerId: string;
    customerEmail: string;
    customerName: string | null;
    assigneeName: string | null;
  }): DeliveryTaskRow => ({
    taskId: row.task.id,
    kind: row.task.kind,
    status: row.task.status,
    entitlementId: row.task.entitlementId,
    product: { id: row.productId, name: row.productName },
    customer: { id: row.customerId, email: row.customerEmail, name: row.customerName },
    assignedTo: row.task.assignedTo === null ? null : { id: row.task.assignedTo, name: row.assigneeName },
    note: row.task.note,
    createdAt: row.task.createdAt.toISOString(),
    doneAt: row.task.doneAt?.toISOString() ?? null,
  });

  const selectTasks = (tx: TxCtx, where: SQL | undefined, limit: number, order: "asc" | "desc") =>
    tx
      .select({
        task: deliveryTasks,
        productId: products.id,
        productName: products.name,
        customerId: users.id,
        customerEmail: users.email,
        customerName: users.name,
        assigneeName: sql<string | null>`(select ${users.name} from ${users} as assignee where assignee.id = ${deliveryTasks.assignedTo})`,
      })
      .from(deliveryTasks)
      .innerJoin(entitlements, eq(entitlements.id, deliveryTasks.entitlementId))
      .innerJoin(products, eq(products.id, entitlements.productId))
      .innerJoin(users, eq(users.id, entitlements.userId))
      .where(where)
      .orderBy(
        ...(order === "asc"
          ? [asc(deliveryTasks.createdAt), asc(deliveryTasks.id)]
          : [desc(deliveryTasks.createdAt), desc(deliveryTasks.id)]),
      )
      .limit(limit);

  const loadTaskScoped = async (tx: TxCtx, ctx: RequestContext, taskId: string) => {
    const [row] = await selectTasks(tx, eq(deliveryTasks.id, taskId), 1, "asc");
    if (row === undefined) throw notFound("Task");
    await assertProductInScope(ctx, row.productId, tx);
    return row;
  };

  const service: DeliveryService = {
    completeProvisioning(ctx, input: CompleteProvisioningInput) {
      return run(async (tx) => {
        const bundle = await loadScoped(tx, ctx, input.entitlementId);
        const { entitlement } = bundle;
        if (entitlement.provisioningState !== "pending") {
          throw new AppError(ErrorCode.STATE_INVALID, "Provisioning is not pending for this entitlement.");
        }
        if (entitlement.status === "revoked" || entitlement.status === "expired") {
          throw new AppError(ErrorCode.STATE_INVALID, `Entitlement is ${entitlement.status}.`);
        }
        const now = deps.now();
        const nextStatus = entitlement.status === "pending" ? "active" : entitlement.status;
        if (nextStatus !== entitlement.status) assertTransition(entitlement.status, nextStatus);
        await tx
          .update(entitlements)
          .set({ provisioningState: "done", provisioningNotes: input.notes, status: nextStatus, updatedAt: now })
          .where(eq(entitlements.id, entitlement.id));
        await closeTasks(tx, entitlement.id, "provision", ctx.userId, now);
        if (input.credentialsEmail) {
          // Credentials travel only by email (D-601); nothing in-app carries them.
          await deps.emails.enqueue({
            to: bundle.customer.email,
            template: "access-provisioned",
            subject: `${bundle.product.name}: your access is ready`,
            data: { productName: bundle.product.name, ...input.notes, url: entitlementDashboardUrl(deps.siteUrl(), entitlement.id) },
          });
        }
        await deps.audit.log(
          ctx,
          "API-DEL-07 entitlement.complete_provisioning",
          subjectOf(entitlement.id),
          { provisioningState: entitlement.provisioningState, status: entitlement.status },
          { provisioningState: "done", status: nextStatus, credentialsEmail: input.credentialsEmail, notes: input.notes },
          tx,
        );
        await refulfil(tx, bundle);
        return adminRow(tx, entitlement.id);
      });
    },

    setLicenseKey(ctx, input: SetLicenseKeyInput) {
      return run(async (tx) => {
        const bundle = await loadScoped(tx, ctx, input.entitlementId);
        const { entitlement } = bundle;
        if (entitlement.deliveryType !== "license") {
          throw new AppError(ErrorCode.STATE_INVALID, "Only license entitlements carry a key.");
        }
        if (entitlement.status === "revoked" || entitlement.status === "expired") {
          throw new AppError(ErrorCode.STATE_INVALID, `Entitlement is ${entitlement.status}.`);
        }
        const now = deps.now();
        const replaced = entitlement.licenseKeyEnc !== null;
        const notes = input.installNotesJson === undefined ? entitlement.provisioningNotes : { installNotesJson: input.installNotesJson };
        await tx
          .update(entitlements)
          .set({
            licenseKeyEnc: encryptLicenseKey(input.licenseKey),
            provisioningState: "done",
            provisioningNotes: notes ?? null,
            status: entitlement.status === "pending" ? "active" : entitlement.status,
            updatedAt: now,
          })
          .where(eq(entitlements.id, entitlement.id));
        await closeTasks(tx, entitlement.id, "provision", ctx.userId, now);
        const url = entitlementDashboardUrl(deps.siteUrl(), entitlement.id);
        // Link only — the key is never placed in a notification or email (D-603, TM-05).
        await deps.notifications.emit(
          bundle.customer.id,
          "license.ready",
          { entitlementId: entitlement.id, productName: bundle.product.name, link: url },
          input.notifyEmail ? ["inapp", "email"] : ["inapp"],
          tx,
        );
        if (input.notifyEmail) {
          await deps.emails.enqueue({
            to: bundle.customer.email,
            template: "delivery-license-key",
            subject: `${bundle.product.name}: your license key is ready`,
            data: { productName: bundle.product.name, url },
          });
        }
        await deps.audit.log(
          ctx,
          "API-DEL-08 license.set",
          subjectOf(entitlement.id),
          { keyIssued: replaced },
          { keyIssued: true, replaced, notifyEmail: input.notifyEmail },
          tx,
        );
        await refulfil(tx, bundle);
        return adminRow(tx, entitlement.id);
      });
    },

    markServiceStep(ctx, input: MarkServiceStepInput) {
      return run(async (tx) => {
        const bundle = await loadScoped(tx, ctx, input.entitlementId);
        const { entitlement } = bundle;
        const [row] = await tx
          .select()
          .from(serviceProgress)
          .where(and(eq(serviceProgress.entitlementId, entitlement.id), eq(serviceProgress.stepKey, input.stepKey)))
          .limit(1);
        if (row === undefined) throw notFound("Service step");
        const now = deps.now();
        await tx
          .update(serviceProgress)
          .set({
            doneAt: input.done ? now : null,
            doneBy: input.done ? ctx.userId : null,
            note: input.note ?? row.note,
            updatedAt: now,
          })
          .where(eq(serviceProgress.id, row.id));
        const steps = stepsFromOffering(bundle.offering.serviceSteps);
        const titleOf = (key: string) => steps.find((s) => s.key === key)?.title ?? key;
        await deps.notifications.emit(
          bundle.customer.id,
          "service.progress",
          {
            entitlementId: entitlement.id,
            productName: bundle.product.name,
            stepKey: input.stepKey,
            stepTitle: titleOf(input.stepKey),
            done: input.done,
            link: entitlementDashboardUrl(deps.siteUrl(), entitlement.id),
          },
          ["inapp", "email"],
          tx,
        );
        await deps.emails.enqueue({
          to: bundle.customer.email,
          template: "service-progress",
          subject: `${bundle.product.name}: ${titleOf(input.stepKey)} ${input.done ? "completed" : "reopened"}`,
          data: { productName: bundle.product.name, stepTitle: titleOf(input.stepKey), done: input.done, url: entitlementDashboardUrl(deps.siteUrl(), entitlement.id) },
        });
        await deps.audit.log(
          ctx,
          "API-DEL-09 service.step",
          subjectOf(entitlement.id),
          { stepKey: input.stepKey, doneAt: row.doneAt?.toISOString() ?? null },
          { stepKey: input.stepKey, done: input.done, note: input.note ?? null },
          tx,
        );
        const fulfilled = await refulfil(tx, bundle);
        const progress = await tx
          .select()
          .from(serviceProgress)
          .where(eq(serviceProgress.entitlementId, entitlement.id))
          .orderBy(asc(serviceProgress.createdAt));
        return {
          progress: progress.map((p) => ({
            key: p.stepKey,
            title: titleOf(p.stepKey),
            doneAt: p.doneAt?.toISOString() ?? null,
            note: p.note,
          })),
          fulfilled,
        };
      });
    },

    listDeliveryTasks(ctx, input: ListDeliveryTasksInput) {
      const scope = resolveProductScope(ctx);
      const conditions: SQL[] = [];
      const scoped = productScopeCondition(scope, entitlements.productId);
      if (scoped !== undefined) conditions.push(scoped);
      const f = input.filters;
      if (f?.kind !== undefined) conditions.push(eq(deliveryTasks.kind, f.kind));
      if (f?.status !== undefined) conditions.push(eq(deliveryTasks.status, f.status));
      if (f?.assignedTo !== undefined) {
        conditions.push(eq(deliveryTasks.assignedTo, f.assignedTo === "me" ? ctx.userId : f.assignedTo));
      }
      const dir: "asc" | "desc" = input.sort?.endsWith(":asc") ? "asc" : "desc";
      if (input.cursor !== undefined) {
        const c = taskCursor(input.cursor);
        const cmp = dir === "asc" ? sql`>` : sql`<`;
        conditions.push(sql`(${deliveryTasks.createdAt}, ${deliveryTasks.id}) ${cmp} (${c.createdAt}::timestamptz, ${c.id}::uuid)`);
      }
      return run(async (tx) => {
        const rows = await selectTasks(tx, conditions.length === 0 ? undefined : and(...conditions), input.limit + 1, dir);
        const page = rows.slice(0, input.limit);
        const last = page[page.length - 1];
        return {
          items: page.map(toTaskRow),
          nextCursor:
            rows.length > input.limit && last !== undefined
              ? Buffer.from(JSON.stringify({ createdAt: last.task.createdAt.toISOString(), id: last.task.id }), "utf8").toString("base64url")
              : null,
        };
      });
    },

    completeDeliveryTask(ctx, input: CompleteDeliveryTaskInput) {
      return run(async (tx) => {
        const row = await loadTaskScoped(tx, ctx, input.taskId);
        if (row.task.status === "done") throw new AppError(ErrorCode.STATE_INVALID, "Task is already done.");
        const now = deps.now();
        await tx
          .update(deliveryTasks)
          .set({ status: "done", doneAt: now, note: input.note ?? row.task.note, assignedTo: row.task.assignedTo ?? ctx.userId, updatedAt: now })
          .where(and(eq(deliveryTasks.id, input.taskId), eq(deliveryTasks.status, "open")));
        if (row.task.kind === "revoke_external") {
          const [ent] = await tx
            .select({ status: entitlements.status })
            .from(entitlements)
            .where(eq(entitlements.id, row.task.entitlementId))
            .limit(1);
          if (ent !== undefined && ent.status !== "revoked") {
            await entitlementsService.revoke(row.task.entitlementId, input.note ?? "external access revoked", tx);
          }
        }
        await deps.audit.log(
          ctx,
          "API-DEL-10 delivery_task.complete",
          { type: "delivery_task", id: input.taskId },
          { status: "open" },
          { status: "done", kind: row.task.kind, note: input.note ?? null },
          tx,
        );
        const [updated] = await selectTasks(tx, eq(deliveryTasks.id, input.taskId), 1, "asc");
        if (updated === undefined) throw notFound("Task");
        return toTaskRow(updated);
      });
    },

    assignDeliveryTask(ctx, input: AssignDeliveryTaskInput) {
      return run(async (tx) => {
        const row = await loadTaskScoped(tx, ctx, input.taskId);
        await tx
          .update(deliveryTasks)
          .set({ assignedTo: input.assignedTo, updatedAt: deps.now() })
          .where(eq(deliveryTasks.id, input.taskId));
        await deps.audit.log(
          ctx,
          "API-DEL-10 delivery_task.assign",
          { type: "delivery_task", id: input.taskId },
          { assignedTo: row.task.assignedTo },
          { assignedTo: input.assignedTo },
          tx,
        );
        const [updated] = await selectTasks(tx, eq(deliveryTasks.id, input.taskId), 1, "asc");
        if (updated === undefined) throw notFound("Task");
        return toTaskRow(updated);
      });
    },

    evaluateOrderFulfilment(orderId, tx) {
      return evaluateOrderFulfilment(orderId, tx, deps.handlers, deps.now());
    },
  };
  return service;
}

export const DELIVERY_SERVICE_METHODS = [
  "completeProvisioning",
  "setLicenseKey",
  "markServiceStep",
  "listDeliveryTasks",
  "completeDeliveryTask",
  "assignDeliveryTask",
  "evaluateOrderFulfilment",
] as const satisfies readonly (keyof DeliveryService)[];

/** Lazily-wired singleton (ports from `modules/entitlements/deps.ts`). */
export const deliveryService: DeliveryService = lazyService(DELIVERY_SERVICE_METHODS, () =>
  createDeliveryService(resolveDeliveryPorts()),
);

/** Order items of one order (helper for callers that only hold an order id). */
export async function orderItemIdsOf(orderId: string, tx: TxCtx): Promise<string[]> {
  const rows = await tx.select({ id: orderItems.id }).from(orderItems).where(eq(orderItems.orderId, orderId));
  return rows.map((r) => r.id);
}
