/**
 * `entitlements` service — PHASE-05 P5.1 (grant / state machine / revoke / expire / extend /
 * manual grant / reset cap / reads), P5.3 (`issueDownloadLink`), P5.4 (`revealLicenseKey`).
 * Implements the frozen `EntitlementsService` contract (`./contracts.ts`); every method runs its
 * writes in one transaction (`withTx`), audits admin mutations in that transaction
 * (MASTER_SPEC §4.9) and dispatches the per-type `DeliveryHandler`.
 *
 * `createEntitlementsService(deps)` builds an instance over explicit ports (tests inject fakes);
 * `entitlementsService` is the lazily-wired singleton (`./deps.ts`).
 */
import { and, asc, desc, eq, inArray, isNull, lt, notExists, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { RequestContext } from "@/lib/authz/context";
import { type TxCtx, withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import type { JobContext, JobOutcome } from "@/modules/analytics/types";
import { users } from "../../../drizzle/schema/auth";
import { orderItems, orders } from "../../../drizzle/schema/commerce";
import {
  type Entitlement,
  downloads,
  entitlements,
  subscriptions,
} from "../../../drizzle/schema/delivery";
import { offerings } from "../../../drizzle/schema/offerings";
import type { RevokeOutcome } from "@/modules/delivery/handler";
import { evaluateOrderFulfilment } from "@/modules/delivery/fulfilment";
import { DOWNLOAD_URL_TTL_SECONDS, downloadFilename } from "@/modules/delivery/downloads";
import { decryptLicenseKey } from "@/modules/delivery/license";
import { filterReleaseFiles } from "@/modules/delivery/update-policy";
import { computeAccessWindow, isWithinAccessWindow } from "./access-window";
import type { EntitlementsService, GrantedEntitlement, SystemRevokeReason } from "./contracts";
import {
  type DeliveryPorts,
  INTERVAL_MONTHS,
  RATE_LIMITS,
  entitlementDashboardUrl,
  lazyService,
  resolveDeliveryPorts,
} from "./deps";
import { assertProductInScope, productScopeCondition, resolveProductScope } from "./scope";
import { OWNED_STATUSES, assertTransition } from "./state";
import type {
  DownloadLinkResult,
  EntitlementAdminRow,
  EntitlementView,
  ExtendAccessInput,
  GetEntitlementAdminInput,
  GetMyEntitlementInput,
  GrantEntitlementResult,
  IssueDownloadLinkInput,
  LicenseKeyReveal,
  ListEntitlementsAdminInput,
  ListMyEntitlementsInput,
  ListResult,
  ResetDownloadCountInput,
  RevealLicenseKeyInput,
  RevokeEntitlementInput,
  RevokeEntitlementResult,
} from "./types";
import {
  type EntitlementBundle,
  handlerContext,
  loadEntitlementBundle,
  loadEntitlementBundles,
  toAdminRow,
  toEntitlementView,
} from "./view";

export type { DeliveryPorts as EntitlementsDeps } from "./deps";

// ---------------------------------------------------------------------------------------------
// Cursor pagination (docs/06 §1.8): keyset on (sort value, id)
// ---------------------------------------------------------------------------------------------

type SortField = "createdAt" | "updatedAt" | "accessEndsAt" | "status";
type SortDir = "asc" | "desc";

interface Cursor {
  v: string | null;
  id: string;
}

const SORT_COLUMNS: Record<SortField, PgColumn> = {
  createdAt: entitlements.createdAt,
  updatedAt: entitlements.updatedAt,
  accessEndsAt: entitlements.accessEndsAt,
  status: entitlements.status,
};

function parseSort(sort: string | undefined): { field: SortField; dir: SortDir } {
  if (sort === undefined) return { field: "createdAt", dir: "desc" };
  const [field, dir] = sort.split(":") as [SortField, SortDir];
  return { field, dir };
}

function encodeCursor(row: Entitlement, field: SortField): string {
  const raw = row[field];
  const v = raw instanceof Date ? raw.toISOString() : raw === null ? null : String(raw);
  return Buffer.from(JSON.stringify({ v, id: row.id } satisfies Cursor), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): Cursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as Partial<Cursor>;
    if (typeof parsed.id !== "string" || (parsed.v !== null && typeof parsed.v !== "string")) {
      throw new Error("bad cursor");
    }
    return { v: parsed.v ?? null, id: parsed.id };
  } catch {
    throw new AppError(ErrorCode.VALIDATION, "Invalid cursor.", {
      fieldErrors: { cursor: ["invalid cursor"] },
    });
  }
}

function sortExpr(field: SortField): SQL {
  const col = SORT_COLUMNS[field];
  return field === "accessEndsAt" ? sql`coalesce(${col}, 'infinity'::timestamptz)` : sql`${col}`;
}

function cursorValueExpr(field: SortField, v: string | null): SQL {
  if (field === "status") return sql`${v}::entitlement_status`;
  if (v === null) return sql`'infinity'::timestamptz`;
  return sql`${v}::timestamptz`;
}

function keysetCondition(field: SortField, dir: SortDir, cursor: Cursor): SQL {
  const cmp = dir === "asc" ? sql`>` : sql`<`;
  return sql`(${sortExpr(field)}, ${entitlements.id}) ${cmp} (${cursorValueExpr(field, cursor.v)}, ${cursor.id}::uuid)`;
}

function orderBy(field: SortField, dir: SortDir): SQL[] {
  const primary = sortExpr(field);
  return dir === "asc"
    ? [asc(primary), asc(entitlements.id)]
    : [desc(primary), desc(entitlements.id)];
}

// ---------------------------------------------------------------------------------------------

function notFound(what = "Entitlement"): AppError {
  return new AppError(ErrorCode.NOT_FOUND, `${what} not found.`);
}

function subjectOf(entitlementId: string) {
  return { type: "entitlement", id: entitlementId };
}

export function createEntitlementsService(deps: DeliveryPorts): EntitlementsService {
  const run = <T>(fn: (tx: TxCtx) => Promise<T>, outer?: TxCtx): Promise<T> =>
    withTx(fn, outer, deps.db);

  const reloadBundle = async (tx: TxCtx, id: string): Promise<EntitlementBundle> => {
    const bundle = await loadEntitlementBundle(tx, id);
    if (bundle === null) throw notFound();
    return bundle;
  };

  const loadOwnBundle = async (tx: TxCtx, ctx: RequestContext, id: string) => {
    const bundle = await loadEntitlementBundle(tx, id);
    if (bundle === null || bundle.entitlement.userId !== ctx.userId) throw notFound();
    return bundle;
  };

  const loadScopedBundle = async (tx: TxCtx, ctx: RequestContext, id: string) => {
    const bundle = await loadEntitlementBundle(tx, id);
    if (bundle === null) throw notFound();
    await assertProductInScope(ctx, bundle.entitlement.productId, tx);
    return bundle;
  };

  const viewOptions = (requestId: string) => ({
    registry: deps.handlers,
    renderRichText: deps.renderRichText,
    now: deps.now(),
    requestId,
  });

  /** Insert the row, create the subscription when needed, run `onGranted`, apply its outcome. */
  async function grantOne(
    tx: TxCtx,
    input: {
      userId: string;
      offeringId: string;
      productId: string;
      orderItemId: string | null;
      grantedManuallyBy: string | null;
      accessMonths?: number | null;
      startsAt: Date;
      requestId: string;
    },
  ): Promise<{ bundle: EntitlementBundle; taskIds: string[] }> {
    const [offering] = await tx.select().from(offerings).where(eq(offerings.id, input.offeringId)).limit(1);
    if (offering === undefined) throw notFound("Offering");
    const config = offering.deliveryConfig;
    const window = computeAccessWindow({
      startsAt: input.startsAt,
      accessMonths: input.accessMonths,
      deliveryConfig: config,
    });
    const now = deps.now();
    const [row] = await tx
      .insert(entitlements)
      .values({
        userId: input.userId,
        offeringId: offering.id,
        orderItemId: input.orderItemId,
        productId: input.productId,
        deliveryType: offering.deliveryType,
        status: "pending",
        accessStartsAt: window.startsAt,
        accessEndsAt: window.endsAt,
        updatePolicy: config.updatePolicy ?? "all_free",
        downloadCap: offering.deliveryType === "download" ? (config.downloadCap ?? null) : null,
        downloadsUsed: 0,
        provisioningState: "n/a",
        grantedManuallyBy: input.grantedManuallyBy,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (row === undefined) throw new Error("entitlements insert returned no row");

    if (offering.purchaseModel === "subscription") {
      const interval = offering.billingInterval ?? "monthly";
      const periodEnd =
        input.accessMonths === undefined || input.accessMonths === null
          ? null
          : computeAccessWindow({
              startsAt: window.startsAt,
              accessMonths: input.accessMonths,
              deliveryConfig: {},
            }).endsAt;
      const sub = await deps.subscriptions.createForEntitlement(
        {
          entitlementId: row.id,
          interval,
          periodStart: window.startsAt,
          periodEnd: periodEnd ?? computeAccessWindow({
            startsAt: window.startsAt,
            accessMonths: INTERVAL_MONTHS[interval],
            deliveryConfig: {},
          }).endsAt,
        },
        tx,
      );
      await tx
        .update(entitlements)
        .set({ accessEndsAt: sub.currentPeriodEnd, updatedAt: now })
        .where(eq(entitlements.id, row.id));
    }

    const bundle = await reloadBundle(tx, row.id);
    const handler = deps.handlers.get(bundle.entitlement.deliveryType);
    const ctx = handlerContext(bundle, {
      actorId: input.grantedManuallyBy,
      requestId: input.requestId,
      manualGrant: input.orderItemId === null,
    });
    const outcome = await handler.onGranted(ctx, bundle.entitlement, tx);
    assertTransition("pending", outcome.status);
    await tx
      .update(entitlements)
      .set({ status: outcome.status, provisioningState: outcome.provisioningState, updatedAt: now })
      .where(and(eq(entitlements.id, row.id), eq(entitlements.status, "pending")));
    for (const email of outcome.emails) {
      await deps.emails.enqueue({
        to: bundle.customer.email,
        template: email.template,
        subject: `${bundle.product.name}: access update`,
        data: email.data,
      });
    }
    return { bundle: await reloadBundle(tx, row.id), taskIds: outcome.taskIds };
  }

  async function revokeInTx(
    tx: TxCtx,
    bundle: EntitlementBundle,
    reason: string,
    actorId: string | null,
    requestId: string,
  ): Promise<{ row: EntitlementAdminRow; outcome: RevokeOutcome }> {
    const { entitlement } = bundle;
    assertTransition(entitlement.status, "revoked");
    const now = deps.now();
    const updated = await tx
      .update(entitlements)
      .set({ status: "revoked", revokedAt: now, revokeReason: reason, updatedAt: now })
      .where(and(eq(entitlements.id, entitlement.id), eq(entitlements.status, entitlement.status)))
      .returning({ id: entitlements.id });
    if (updated.length === 0) {
      throw new AppError(ErrorCode.CONFLICT, "Entitlement changed concurrently; reload and retry.");
    }
    if (bundle.subscription !== null && bundle.subscription.status !== "cancelled") {
      await tx
        .update(subscriptions)
        .set({ status: "cancelled", cancelAtPeriodEnd: true, graceUntil: null, updatedAt: now })
        .where(eq(subscriptions.id, bundle.subscription.id));
    }
    const handler = deps.handlers.get(entitlement.deliveryType);
    const outcome = await handler.onRevoked(
      handlerContext(bundle, { actorId, requestId, manualGrant: entitlement.orderItemId === null }),
      { ...entitlement, status: "revoked", revokedAt: now, revokeReason: reason },
      { mode: "hard", reason },
      tx,
    );
    await deps.emails.enqueue({
      to: bundle.customer.email,
      template: "access-revoked",
      subject: `${bundle.product.name}: access revoked`,
      data: { productName: bundle.product.name, reason },
    });
    return { row: toAdminRow(await reloadBundle(tx, entitlement.id), deps.handlers), outcome };
  }

  const service: EntitlementsService = {
    async grantForOrder(orderId, tx) {
      const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      if (order === undefined) throw notFound("Order");
      if (order.status !== "paid" && order.status !== "fulfilled") {
        throw new AppError(ErrorCode.STATE_INVALID, `Order ${order.orderNo} is not paid.`);
      }
      // Renewal orders roll the existing subscription forward instead of creating rows (D-1004).
      const [renewalOf] = await tx
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(eq(subscriptions.renewalOrderId, orderId))
        .limit(1);
      if (renewalOf !== undefined) {
        await deps.subscriptions.onRenewalPaid(orderId, tx);
        return [];
      }
      if (order.userId === null) return [];

      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))
        .orderBy(asc(orderItems.createdAt));
      const granted: GrantedEntitlement[] = [];
      for (const item of items) {
        if (item.offeringId === null || item.productId === null) continue;
        const [existing] = await tx
          .select()
          .from(entitlements)
          .where(eq(entitlements.orderItemId, item.id))
          .limit(1);
        if (existing !== undefined) continue; // idempotent per order_item_id
        const { bundle, taskIds } = await grantOne(tx, {
          userId: order.userId,
          offeringId: item.offeringId,
          productId: item.productId,
          orderItemId: item.id,
          grantedManuallyBy: null,
          startsAt: order.paidAt ?? deps.now(),
          requestId: `order:${orderId}`,
        });
        granted.push({
          entitlementId: bundle.entitlement.id,
          orderItemId: item.id,
          deliveryType: bundle.entitlement.deliveryType,
          status: bundle.entitlement.status,
          taskIds,
        });
      }
      await evaluateOrderFulfilment(orderId, tx, deps.handlers, deps.now());
      return granted;
    },

    grantManual(ctx, input, outerTx) {
      return run(async (tx) => {
        const [offering] = await tx
          .select()
          .from(offerings)
          .where(and(eq(offerings.id, input.offeringId), eq(offerings.status, "active")))
          .limit(1);
        if (offering === undefined) throw notFound("Offering");
        await assertProductInScope(ctx, offering.productId, tx);
        const [customer] = await tx
          .select({ id: users.id, status: users.status })
          .from(users)
          .where(eq(users.id, input.userId))
          .limit(1);
        if (customer === undefined || customer.status === "deleted") throw notFound("User");
        if (offering.purchaseModel === "one_time") {
          const [owned] = await tx
            .select({ id: entitlements.id })
            .from(entitlements)
            .where(
              and(
                eq(entitlements.userId, input.userId),
                eq(entitlements.offeringId, offering.id),
                inArray(entitlements.status, [...OWNED_STATUSES]),
              ),
            )
            .limit(1);
          if (owned !== undefined) throw new AppError(ErrorCode.DUPLICATE_PURCHASE);
        }
        const { bundle } = await grantOne(tx, {
          userId: input.userId,
          offeringId: offering.id,
          productId: offering.productId,
          orderItemId: null,
          grantedManuallyBy: ctx.userId,
          accessMonths: input.accessMonths,
          startsAt: deps.now(),
          requestId: ctx.requestId,
        });
        const id = bundle.entitlement.id;
        await deps.audit.log(
          ctx,
          "API-DEL-11 entitlement.grant_manual",
          subjectOf(id),
          null,
          {
            entitlementId: id,
            userId: input.userId,
            offeringId: offering.id,
            productId: offering.productId,
            deliveryType: bundle.entitlement.deliveryType,
            status: bundle.entitlement.status,
            accessEndsAt: bundle.entitlement.accessEndsAt?.toISOString() ?? null,
            reason: input.reason,
          },
          tx,
        );
        await deps.notifications.emit(
          "admins",
          "entitlement.granted_manually",
          {
            entitlementId: id,
            productName: bundle.product.name,
            offeringName: bundle.offering.name,
            customerEmail: bundle.customer.email,
            grantedBy: ctx.userId,
            reason: input.reason,
          },
          ["inapp"],
          tx,
          { excludeUserId: ctx.userId },
        );
        await deps.emails.enqueue({
          to: bundle.customer.email,
          template: "access-granted",
          subject: `${bundle.product.name}: access granted`,
          data: {
            productName: bundle.product.name,
            url: entitlementDashboardUrl(deps.siteUrl(), id),
          },
        });
        return { entitlementId: id } satisfies GrantEntitlementResult;
      }, outerTx);
    },

    async revoke(entitlementId, reason: SystemRevokeReason | string, tx) {
      const bundle = await reloadBundle(tx, entitlementId);
      const { row, outcome } = await revokeInTx(tx, bundle, reason, null, `system:${reason}`);
      const result: RevokeEntitlementResult = { entitlement: row };
      if (outcome.taskId !== undefined) result.taskId = outcome.taskId;
      return result;
    },

    revokeEntitlement(ctx, input: RevokeEntitlementInput) {
      return run(async (tx) => {
        const bundle = await loadScopedBundle(tx, ctx, input.entitlementId);
        const { row, outcome } = await revokeInTx(tx, bundle, input.reason, ctx.userId, ctx.requestId);
        await deps.audit.log(
          ctx,
          "API-DEL-12 entitlement.revoke",
          subjectOf(input.entitlementId),
          { status: bundle.entitlement.status },
          { status: "revoked", reason: input.reason, taskId: outcome.taskId ?? null },
          tx,
        );
        const result: RevokeEntitlementResult = { entitlement: row };
        if (outcome.taskId !== undefined) result.taskId = outcome.taskId;
        return result;
      });
    },

    async listMyEntitlements(ctx, input: ListMyEntitlementsInput): Promise<ListResult<EntitlementView>> {
      const { field, dir } = parseSort(input.sort);
      const conditions: SQL[] = [eq(entitlements.userId, ctx.userId)];
      if (input.filters?.status !== undefined) conditions.push(eq(entitlements.status, input.filters.status));
      if (input.filters?.deliveryType !== undefined) {
        conditions.push(eq(entitlements.deliveryType, input.filters.deliveryType));
      }
      if (input.cursor !== undefined) conditions.push(keysetCondition(field, dir, decodeCursor(input.cursor)));
      return run(async (tx) => {
        const rows = await tx
          .select()
          .from(entitlements)
          .where(and(...conditions))
          .orderBy(...orderBy(field, dir))
          .limit(input.limit + 1);
        const page = rows.slice(0, input.limit);
        const bundles = await loadEntitlementBundles(tx, page);
        const opts = viewOptions(ctx.requestId);
        const last = page[page.length - 1];
        return {
          items: bundles.map((b) => toEntitlementView(b, opts)),
          nextCursor: rows.length > input.limit && last !== undefined ? encodeCursor(last, field) : null,
        };
      });
    },

    getMyEntitlement(ctx, input: GetMyEntitlementInput) {
      return run(async (tx) => {
        const bundle = await loadOwnBundle(tx, ctx, input.entitlementId);
        let renewalOrderNo: string | null = null;
        if (bundle.subscription?.renewalOrderId) {
          const [o] = await tx
            .select({ orderNo: orders.orderNo })
            .from(orders)
            .where(eq(orders.id, bundle.subscription.renewalOrderId))
            .limit(1);
          renewalOrderNo = o?.orderNo ?? null;
        }
        return toEntitlementView(bundle, { ...viewOptions(ctx.requestId), renewalOrderNo });
      });
    },

    async issueDownloadLink(ctx, input: IssueDownloadLinkInput): Promise<DownloadLinkResult> {
      await deps.rateLimit(`download:user:${ctx.userId}`, RATE_LIMITS.download.limit, RATE_LIMITS.download.windowMs);
      return run(async (tx) => {
        const bundle = await loadOwnBundle(tx, ctx, input.entitlementId);
        const { entitlement } = bundle;
        const now = deps.now();
        if (entitlement.status !== "active" || !isWithinAccessWindow(entitlement, now)) {
          throw new AppError(ErrorCode.STATE_INVALID, "This entitlement is not active.");
        }
        const allowed = filterReleaseFiles(bundle.releaseFiles, {
          updatePolicy: entitlement.updatePolicy,
          accessStartsAt: entitlement.accessStartsAt,
          accessEndsAt: entitlement.accessEndsAt,
        });
        const file = allowed.find((f) => f.mediaId === input.mediaId);
        if (file === undefined) throw notFound("Release file");

        const [counted] = await tx
          .update(entitlements)
          .set({ downloadsUsed: sql`${entitlements.downloadsUsed} + 1`, updatedAt: now })
          .where(
            and(
              eq(entitlements.id, entitlement.id),
              eq(entitlements.status, "active"),
              or(isNull(entitlements.downloadCap), lt(entitlements.downloadsUsed, entitlements.downloadCap)),
            ),
          )
          .returning({ used: entitlements.downloadsUsed, cap: entitlements.downloadCap });
        if (counted === undefined) {
          throw new AppError(
            ErrorCode.LIMIT_EXCEEDED,
            "You have used all downloads for this purchase. Please contact us from your dashboard to reset it.",
          );
        }
        await tx.insert(downloads).values({
          entitlementId: entitlement.id,
          mediaId: file.mediaId,
          userId: ctx.userId,
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent ?? null,
          createdAt: now,
        });
        await deps.audit.log(
          ctx,
          "API-DEL-02 download.issued",
          subjectOf(entitlement.id),
          null,
          { mediaId: file.mediaId, version: file.version, downloadsUsed: counted.used, cap: counted.cap },
          tx,
        );
        const signed = await deps.presigner.presignGet(
          {
            bucket: file.bucket,
            objectKey: file.objectKey,
            filename: downloadFilename(bundle.product.slug, file.version, file.objectKey),
            ttlSeconds: DOWNLOAD_URL_TTL_SECONDS,
            mediaId: file.mediaId,
            mime: file.mime,
          },
          now,
        );
        return {
          url: signed.url,
          expiresAt: signed.expiresAt.toISOString(),
          // -1 = unlimited (no cap on the entitlement).
          downloadsRemaining: counted.cap === null ? -1 : Math.max(0, counted.cap - counted.used),
        };
      });
    },

    async revealLicenseKey(ctx, input: RevealLicenseKeyInput): Promise<LicenseKeyReveal> {
      await deps.rateLimit(`key_reveal:user:${ctx.userId}`, RATE_LIMITS.keyReveal.limit, RATE_LIMITS.keyReveal.windowMs);
      return run(async (tx) => {
        const bundle = await loadOwnBundle(tx, ctx, input.entitlementId);
        const { entitlement } = bundle;
        if (entitlement.status !== "active" || !isWithinAccessWindow(entitlement, deps.now())) {
          throw new AppError(ErrorCode.STATE_INVALID, "This entitlement is not active.");
        }
        if (entitlement.licenseKeyEnc === null || entitlement.licenseKeyEnc === "") {
          throw notFound("License key");
        }
        const licenseKey = decryptLicenseKey(entitlement.licenseKeyEnc);
        await deps.audit.log(ctx, "API-DEL-03 license.revealed", subjectOf(entitlement.id), null, null, tx);
        return { licenseKey };
      });
    },

    listEntitlementsAdmin(ctx, input: ListEntitlementsAdminInput): Promise<ListResult<EntitlementAdminRow>> {
      const scope = resolveProductScope(ctx);
      const { field, dir } = parseSort(input.sort);
      const conditions: SQL[] = [];
      const scoped = productScopeCondition(scope, entitlements.productId);
      if (scoped !== undefined) conditions.push(scoped);
      const f = input.filters;
      if (f?.status !== undefined) conditions.push(inArray(entitlements.status, f.status));
      if (f?.deliveryType !== undefined) conditions.push(eq(entitlements.deliveryType, f.deliveryType));
      if (f?.productId !== undefined) conditions.push(eq(entitlements.productId, f.productId));
      if (f?.userId !== undefined) conditions.push(eq(entitlements.userId, f.userId));
      if (f?.provisioningState !== undefined) {
        conditions.push(eq(entitlements.provisioningState, f.provisioningState));
      }
      if (input.q !== undefined && input.q !== "") {
        const q = `%${input.q}%`;
        conditions.push(
          sql`exists (select 1 from ${users} where ${users.id} = ${entitlements.userId} and (${users.email} ilike ${q} or ${users.name} ilike ${q}))`,
        );
      }
      if (input.cursor !== undefined) conditions.push(keysetCondition(field, dir, decodeCursor(input.cursor)));
      return run(async (tx) => {
        const rows = await tx
          .select()
          .from(entitlements)
          .where(conditions.length === 0 ? undefined : and(...conditions))
          .orderBy(...orderBy(field, dir))
          .limit(input.limit + 1);
        const page = rows.slice(0, input.limit);
        const bundles = await loadEntitlementBundles(tx, page);
        const last = page[page.length - 1];
        return {
          items: bundles.map((b) => toAdminRow(b, deps.handlers)),
          nextCursor: rows.length > input.limit && last !== undefined ? encodeCursor(last, field) : null,
        };
      });
    },

    getEntitlementAdmin(ctx, input: GetEntitlementAdminInput) {
      return run(async (tx) => toAdminRow(await loadScopedBundle(tx, ctx, input.entitlementId), deps.handlers));
    },

    resetDownloadCount(ctx, input: ResetDownloadCountInput) {
      return run(async (tx) => {
        const bundle = await loadScopedBundle(tx, ctx, input.entitlementId);
        const before = { downloadsUsed: bundle.entitlement.downloadsUsed, downloadCap: bundle.entitlement.downloadCap };
        const after = { downloadsUsed: 0, downloadCap: input.newCap ?? bundle.entitlement.downloadCap };
        await tx
          .update(entitlements)
          .set({ downloadsUsed: 0, downloadCap: after.downloadCap, updatedAt: deps.now() })
          .where(eq(entitlements.id, input.entitlementId));
        await deps.audit.log(ctx, "API-DEL-13 entitlement.reset_download_count", subjectOf(input.entitlementId), before, after, tx);
        return toAdminRow(await reloadBundle(tx, input.entitlementId), deps.handlers);
      });
    },

    extendAccess(ctx, input: ExtendAccessInput) {
      return run(async (tx) => {
        const bundle = await loadScopedBundle(tx, ctx, input.entitlementId);
        const now = deps.now();
        const before = {
          accessEndsAt: bundle.entitlement.accessEndsAt?.toISOString() ?? null,
          periodEnd: bundle.subscription?.currentPeriodEnd.toISOString() ?? null,
        };
        let after: Record<string, unknown>;
        if (input.periodEnd !== undefined) {
          if (bundle.subscription === null) {
            throw new AppError(ErrorCode.STATE_INVALID, "This entitlement has no subscription.");
          }
          const periodEnd = new Date(input.periodEnd);
          await tx
            .update(subscriptions)
            .set({ currentPeriodEnd: periodEnd, updatedAt: now })
            .where(eq(subscriptions.id, bundle.subscription.id));
          await tx
            .update(entitlements)
            .set({ accessEndsAt: periodEnd, updatedAt: now })
            .where(eq(entitlements.id, input.entitlementId));
          after = { accessEndsAt: periodEnd.toISOString(), periodEnd: periodEnd.toISOString() };
        } else {
          const accessEndsAt = input.accessEndsAt === null || input.accessEndsAt === undefined ? null : new Date(input.accessEndsAt);
          await tx
            .update(entitlements)
            .set({ accessEndsAt, updatedAt: now })
            .where(eq(entitlements.id, input.entitlementId));
          after = { accessEndsAt: accessEndsAt?.toISOString() ?? null, periodEnd: before.periodEnd };
        }
        await deps.audit.log(
          ctx,
          "API-DEL-14 entitlement.extend_access",
          subjectOf(input.entitlementId),
          before,
          { ...after, reason: input.reason },
          tx,
        );
        return toAdminRow(await reloadBundle(tx, input.entitlementId), deps.handlers);
      });
    },

    async runExpireJob(job: JobContext): Promise<JobOutcome<{ expired: number }>> {
      const expired = await run((tx) => expireAccess(job.now, tx));
      return { status: "ok", detail: { expired: expired.length } };
    },
  };
  return service;
}

/**
 * One-time entitlements past `access_ends_at` → `expired` (D-605). Subscription-backed rows are
 * left to `subscriptions.remind_grace_suspend` (BR-14). State-guarded, so re-runs are no-ops.
 */
export async function expireAccess(now: Date, tx: TxCtx): Promise<string[]> {
  const rows = await tx
    .update(entitlements)
    .set({ status: "expired", updatedAt: now })
    .where(
      and(
        eq(entitlements.status, "active"),
        lt(entitlements.accessEndsAt, now),
        notExists(
          tx.select({ one: sql`1` }).from(subscriptions).where(eq(subscriptions.entitlementId, entitlements.id)),
        ),
      ),
    )
    .returning({ id: entitlements.id });
  return rows.map((r) => r.id);
}

export const ENTITLEMENTS_SERVICE_METHODS = [
  "grantForOrder",
  "grantManual",
  "revoke",
  "revokeEntitlement",
  "listMyEntitlements",
  "getMyEntitlement",
  "issueDownloadLink",
  "revealLicenseKey",
  "listEntitlementsAdmin",
  "getEntitlementAdmin",
  "resetDownloadCount",
  "extendAccess",
  "runExpireJob",
] as const satisfies readonly (keyof EntitlementsService)[];

/** Lazily-wired singleton (ports from `./deps.ts`; nothing connects at import time). */
export const entitlementsService: EntitlementsService = lazyService(ENTITLEMENTS_SERVICE_METHODS, () =>
  createEntitlementsService(resolveDeliveryPorts()),
);
