import { and, desc, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { type TxCtx, getDb, withTx } from "@/lib/db";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { AppError, ErrorCode } from "@/lib/errors";
import { decrypt } from "@/lib/crypto";
import { auditService } from "@/modules/audit/service";
import { getPrivateBucketName, getStorageDriver } from "@/lib/storage";
import {
  deliveryTasks,
  downloads,
  entitlements,
  releaseFiles,
  serviceProgress,
  subscriptions,
  type Entitlement,
} from "../../../drizzle/schema/delivery";
import { orders, orderItems } from "../../../drizzle/schema/commerce";
import { invoices } from "../../../drizzle/schema/invoices";
import { media } from "../../../drizzle/schema/media";
import { products } from "../../../drizzle/schema/catalog";
import { offerings } from "../../../drizzle/schema/offerings";
import { users } from "../../../drizzle/schema/auth";
import type {
  EntitlementsService,
  GrantedEntitlement,
  SystemRevokeReason,
} from "./contracts";
import { defaultDeliveryHandlerRegistry } from "@/modules/delivery/handlers";
import { deliveryService } from "@/modules/delivery/service";
import { subscriptionsService, advancePeriod } from "@/modules/subscriptions/service";
import {
  type DownloadLinkResult,
  type EntitlementAdminRow,
  type EntitlementView,
  type ExtendAccessInput,
  type GetEntitlementAdminInput,
  type GetMyEntitlementInput,
  type GrantEntitlementInput,
  type GrantEntitlementResult,
  type IssueDownloadLinkInput,
  type LicenseKeyReveal,
  type ListEntitlementsAdminInput,
  type ListMyEntitlementsInput,
  type ListResult,
  type ResetDownloadCountInput,
  type RevealLicenseKeyInput,
  type RevokeEntitlementInput,
  type RevokeEntitlementResult,
  extendAccessSchema,
  getEntitlementAdminSchema,
  getMyEntitlementSchema,
  grantEntitlementSchema,
  issueDownloadLinkSchema,
  listEntitlementsAdminSchema,
  listMyEntitlementsSchema,
  resetDownloadCountSchema,
  revealLicenseKeySchema,
  revokeEntitlementSchema,
} from "./types";
import { assertValidEntitlementTransition } from "./state";
import { calculateAccessEndsAt, isWithinAccessWindow } from "./access";
import type { JobContext, JobOutcome } from "@/modules/analytics/types";

export class DefaultEntitlementsService implements EntitlementsService {
  constructor(
    private readonly registry = defaultDeliveryHandlerRegistry,
    private readonly delivery = deliveryService,
    private readonly subscriptions = subscriptionsService,
  ) {}

  async grantForOrder(orderId: string, tx: TxCtx): Promise<GrantedEntitlement[]> {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");

    if (!order) {
      throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
    }

    // Renewal orders are linked via subscriptions.renewalOrderId
    const [linkedSub] = await tx
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.renewalOrderId, order.id));

    if (linkedSub) {
      await this.subscriptions.onRenewalPaid(order.id, tx);
      return [];
    }

    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    const granted: GrantedEntitlement[] = [];

    for (const item of items) {
      if (!item.offeringId) continue;

      // Idempotency: check if entitlement already exists for this order item
      const [existing] = await tx
        .select()
        .from(entitlements)
        .where(eq(entitlements.orderItemId, item.id));

      if (existing) {
        granted.push({
          entitlementId: existing.id,
          orderItemId: item.id,
          deliveryType: existing.deliveryType,
          status: existing.status,
          taskIds: [],
        });
        continue;
      }

      const [offering] = await tx
        .select()
        .from(offerings)
        .where(eq(offerings.id, item.offeringId));

      if (!offering) continue;

      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, offering.productId));

      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, order.userId!));

      const startsAt = order.paidAt ?? new Date();
      let endsAt: Date | null = null;

      if (offering.purchaseModel === "subscription") {
        endsAt = advancePeriod(startsAt, (offering.billingInterval ?? "monthly") as any);
      } else {
        endsAt = calculateAccessEndsAt(startsAt, offering.accessMonths);
      }

      // Handler context
      const handler = this.registry.get(offering.deliveryType);
      const handlerCtx = {
        actorId: null,
        requestId: order.id,
        offering: {
          id: offering.id,
          name: offering.name,
          deliveryConfig: offering.deliveryConfig as any,
          serviceSteps: offering.serviceSteps as any,
          purchaseModel: offering.purchaseModel as any,
        },
        product: { id: product!.id, name: product!.name, slug: product!.slug },
        customer: { id: user!.id, email: user!.email, name: user!.name },
        subscription: null,
        manualGrant: false,
      };

      const [newEnt] = await tx
        .insert(entitlements)
        .values({
          userId: order.userId!,
          offeringId: offering.id,
          orderItemId: item.id,
          productId: offering.productId,
          deliveryType: offering.deliveryType,
          status: "pending", // will be updated by handler outcome
          accessStartsAt: startsAt,
          accessEndsAt: endsAt,
          updatePolicy: (offering.deliveryConfig as any)?.updatePolicy ?? "all_free",
          downloadCap: (offering.deliveryConfig as any)?.downloadCap ?? null,
          provisioningState: "n/a",
        })
        .returning();

      const outcome = await handler.onGranted(handlerCtx, newEnt!, tx);

      const [updatedEnt] = await tx
        .update(entitlements)
        .set({
          status: outcome.status,
          provisioningState: outcome.provisioningState,
          updatedAt: new Date(),
        })
        .where(eq(entitlements.id, newEnt!.id))
        .returning();

      // If subscription, insert subscriptions row
      if (offering.purchaseModel === "subscription") {
        await tx.insert(subscriptions).values({
          entitlementId: updatedEnt!.id,
          interval: (offering.billingInterval ?? "monthly") as any,
          currentPeriodStart: startsAt,
          currentPeriodEnd: endsAt!,
          status: "active",
        });
      }

      granted.push({
        entitlementId: updatedEnt!.id,
        orderItemId: item.id,
        deliveryType: updatedEnt!.deliveryType,
        status: updatedEnt!.status,
        taskIds: outcome.taskIds,
      });
    }

    // Evaluate order fulfilment
    await this.delivery.evaluateOrderFulfilment(order.id, tx);

    return granted;
  }

  async grantManual(
    ctx: RequestContext,
    rawInput: GrantEntitlementInput,
    outerTx?: TxCtx,
  ): Promise<GrantEntitlementResult> {
    assertPermission(ctx, "entitlements.admin");
    const input = grantEntitlementSchema.parse(rawInput);

    const runner = async (tx: TxCtx): Promise<GrantEntitlementResult> => {
      const [offering] = await tx
        .select()
        .from(offerings)
        .where(eq(offerings.id, input.offeringId));

      if (!offering) {
        throw new AppError(ErrorCode.NOT_FOUND, "Offering not found");
      }

      // Check duplicate purchase for active one-time offerings
      if (offering.purchaseModel === "one_time") {
        const [existing] = await tx
          .select({ id: entitlements.id })
          .from(entitlements)
          .where(
            and(
              eq(entitlements.userId, input.userId),
              eq(entitlements.offeringId, input.offeringId),
              eq(entitlements.status, "active"),
            ),
          );

        if (existing) {
          throw new AppError(
            ErrorCode.DUPLICATE_PURCHASE,
            "User already holds an active entitlement for this offering",
          );
        }
      }

      const [product] = await tx
        .select()
        .from(products)
        .where(eq(products.id, offering.productId));

      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, input.userId));

      if (!user) {
        throw new AppError(ErrorCode.NOT_FOUND, "User not found");
      }

      const startsAt = new Date();
      const accessMonths = input.accessMonths !== undefined ? input.accessMonths : offering.accessMonths;
      const endsAt = calculateAccessEndsAt(startsAt, accessMonths);

      const handler = this.registry.get(offering.deliveryType);
      const handlerCtx = {
        actorId: ctx.userId,
        requestId: ctx.requestId ?? "manual-grant",
        offering: {
          id: offering.id,
          name: offering.name,
          deliveryConfig: offering.deliveryConfig as any,
          serviceSteps: offering.serviceSteps as any,
          purchaseModel: offering.purchaseModel as any,
        },
        product: { id: product!.id, name: product!.name, slug: product!.slug },
        customer: { id: user.id, email: user.email, name: user.name },
        subscription: null,
        manualGrant: true,
      };

      const [newEnt] = await tx
        .insert(entitlements)
        .values({
          userId: user.id,
          offeringId: offering.id,
          orderItemId: null,
          productId: offering.productId,
          deliveryType: offering.deliveryType,
          status: "pending",
          accessStartsAt: startsAt,
          accessEndsAt: endsAt,
          updatePolicy: (offering.deliveryConfig as any)?.updatePolicy ?? "all_free",
          downloadCap: (offering.deliveryConfig as any)?.downloadCap ?? null,
          provisioningState: "n/a",
          grantedManuallyBy: ctx.userId,
        })
        .returning();

      const outcome = await handler.onGranted(handlerCtx, newEnt!, tx);

      const [updatedEnt] = await tx
        .update(entitlements)
        .set({
          status: outcome.status,
          provisioningState: outcome.provisioningState,
          updatedAt: new Date(),
        })
        .where(eq(entitlements.id, newEnt!.id))
        .returning();

      await auditService.log(
        ctx,
        "entitlement.granted_manually",
        { type: "entitlement", id: updatedEnt!.id },
        null,
        {
          userId: input.userId,
          offeringId: input.offeringId,
          reason: input.reason,
          accessMonths,
        },
        tx,
      );

      return {
        entitlementId: updatedEnt!.id,
      };
    };

    if (outerTx) return await runner(outerTx);
    return await withTx(runner);
  }

  async revoke(
    entitlementId: string,
    reason: SystemRevokeReason | string,
    tx: TxCtx,
  ): Promise<RevokeEntitlementResult> {
    const [ent] = await tx
      .select()
      .from(entitlements)
      .where(eq(entitlements.id, entitlementId))
      .for("update");

    if (!ent) {
      throw new AppError(ErrorCode.NOT_FOUND, "Entitlement not found");
    }

    assertValidEntitlementTransition(ent.status, "revoked");

    const [offering] = await tx.select().from(offerings).where(eq(offerings.id, ent.offeringId));
    const [product] = await tx.select().from(products).where(eq(products.id, ent.productId));
    const [user] = await tx.select().from(users).where(eq(users.id, ent.userId));

    const handler = this.registry.get(ent.deliveryType);
    const handlerCtx = {
      actorId: null,
      requestId: "revoke",
      offering: {
        id: offering!.id,
        name: offering!.name,
        deliveryConfig: offering!.deliveryConfig as any,
        serviceSteps: offering!.serviceSteps as any,
        purchaseModel: offering!.purchaseModel as any,
      },
      product: { id: product!.id, name: product!.name, slug: product!.slug },
      customer: { id: user!.id, email: user!.email, name: user!.name },
      subscription: null,
      manualGrant: ent.orderItemId === null,
    };

    const outcome = await handler.onRevoked(
      handlerCtx,
      ent,
      { mode: "hard", reason },
      tx,
    );

    const now = new Date();
    const [updated] = await tx
      .update(entitlements)
      .set({
        status: "revoked",
        revokedAt: now,
        revokeReason: reason,
        updatedAt: now,
      })
      .where(eq(entitlements.id, ent.id))
      .returning();

    const adminRow = await this.buildAdminRow(updated!, tx);

    return {
      entitlement: adminRow,
      taskId: outcome.taskId,
    };
  }

  async revokeEntitlement(
    ctx: RequestContext,
    rawInput: RevokeEntitlementInput,
  ): Promise<RevokeEntitlementResult> {
    assertPermission(ctx, "entitlements.admin");
    const input = revokeEntitlementSchema.parse(rawInput);

    return await withTx(async (tx) => {
      const res = await this.revoke(input.entitlementId, input.reason, tx);

      await auditService.log(
        ctx,
        "entitlement.revoked",
        { type: "entitlement", id: input.entitlementId },
        { status: res.entitlement.status },
        { status: "revoked", reason: input.reason },
        tx,
      );

      return res;
    });
  }

  async listMyEntitlements(
    ctx: RequestContext,
    rawInput: ListMyEntitlementsInput,
  ): Promise<ListResult<EntitlementView>> {
    assertPermission(ctx, "delivery.self");
    const input = listMyEntitlementsSchema.parse(rawInput);
    const db = await getDb();

    const conditions = [eq(entitlements.userId, ctx.userId!)];
    if (input.filters.status) {
      conditions.push(eq(entitlements.status, input.filters.status));
    }
    if (input.filters.deliveryType) {
      conditions.push(eq(entitlements.deliveryType, input.filters.deliveryType));
    }

    const rows = await db
      .select()
      .from(entitlements)
      .where(and(...conditions))
      .orderBy(desc(entitlements.createdAt))
      .limit(input.limit + 1);

    const hasNext = rows.length > input.limit;
    const currentRows = hasNext ? rows.slice(0, input.limit) : rows;

    const views: EntitlementView[] = [];
    for (const row of currentRows) {
      views.push(await this.buildCustomerView(row, db));
    }

    return {
      items: views,
      nextCursor: hasNext ? currentRows[currentRows.length - 1]?.id ?? null : null,
    };
  }

  async getMyEntitlement(
    ctx: RequestContext,
    rawInput: GetMyEntitlementInput,
  ): Promise<EntitlementView> {
    assertPermission(ctx, "delivery.self");
    const input = getMyEntitlementSchema.parse(rawInput);
    const db = await getDb();

    const [row] = await db
      .select()
      .from(entitlements)
      .where(and(eq(entitlements.id, input.entitlementId), eq(entitlements.userId, ctx.userId!)));

    if (!row) {
      throw new AppError(ErrorCode.NOT_FOUND, "Entitlement not found");
    }

    return await this.buildCustomerView(row, db);
  }

  async issueDownloadLink(
    ctx: RequestContext,
    rawInput: IssueDownloadLinkInput,
  ): Promise<DownloadLinkResult> {
    assertPermission(ctx, "delivery.self");
    const input = issueDownloadLinkSchema.parse(rawInput);

    return await withTx(async (tx) => {
      const [ent] = await tx
        .select()
        .from(entitlements)
        .where(eq(entitlements.id, input.entitlementId))
        .for("update");

      if (!ent) {
        throw new AppError(ErrorCode.NOT_FOUND, "Entitlement not found");
      }

      if (ctx.userId && ent.userId !== ctx.userId && !ctx.roles.includes("super_admin") && !ctx.roles.includes("admin")) {
        throw new AppError(ErrorCode.NOT_FOUND, "Entitlement not found");
      }

      if (ent.status !== "active") {
        throw new AppError(ErrorCode.STATE_INVALID, `Cannot download when entitlement is '${ent.status}'`);
      }

      if (!isWithinAccessWindow(ent.accessStartsAt, ent.accessEndsAt)) {
        throw new AppError(ErrorCode.STATE_INVALID, "Access window has expired");
      }

      // Check media in release_files
      const [rf] = await tx
        .select()
        .from(releaseFiles)
        .where(
          and(
            eq(releaseFiles.productId, ent.productId),
            eq(releaseFiles.mediaId, input.mediaId),
          ),
        );

      if (!rf) {
        throw new AppError(ErrorCode.NOT_FOUND, "Release file not found for this product");
      }

      // Atomic cap increment
      let updatedEnt: typeof entitlements.$inferSelect | undefined;
      if (ent.downloadCap !== null) {
        const [res] = await tx
          .update(entitlements)
          .set({
            downloadsUsed: sql`${entitlements.downloadsUsed} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(entitlements.id, ent.id),
              sql`${entitlements.downloadsUsed} < ${ent.downloadCap}`,
            ),
          )
          .returning();

        if (!res) {
          throw new AppError(
            ErrorCode.LIMIT_EXCEEDED,
            "Download cap reached for this entitlement. Please contact support.",
          );
        }
        updatedEnt = res;
      } else {
        const [res] = await tx
          .update(entitlements)
          .set({
            downloadsUsed: sql`${entitlements.downloadsUsed} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(entitlements.id, ent.id))
          .returning();
        updatedEnt = res!;
      }

      // Record download log
      await tx.insert(downloads).values({
        entitlementId: ent.id,
        mediaId: input.mediaId,
        userId: ctx.userId ?? ent.userId,
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      });

      await auditService.log(
        ctx,
        "download.issued",
        { type: "entitlement", id: ent.id },
        null,
        { mediaId: input.mediaId, downloadsUsed: updatedEnt!.downloadsUsed },
        tx,
      );

      // Presigned 5-minute GET URL (SA-12)
      const storage = getStorageDriver();
      const bucket = getPrivateBucketName();
      const [med] = await tx.select().from(media).where(eq(media.id, input.mediaId));
      const storageKey = med?.objectKey ?? input.mediaId;
      const url = await storage.createPresignedGet(bucket, storageKey, 300);

      const remaining =
        updatedEnt!.downloadCap === null
          ? 999999
          : Math.max(0, updatedEnt!.downloadCap - updatedEnt!.downloadsUsed);

      return {
        url,
        expiresAt: new Date(Date.now() + 300 * 1000).toISOString(),
        downloadsRemaining: remaining,
      };
    });
  }

  async revealLicenseKey(
    ctx: RequestContext,
    rawInput: RevealLicenseKeyInput,
  ): Promise<LicenseKeyReveal> {
    assertPermission(ctx, "delivery.self");
    const input = revealLicenseKeySchema.parse(rawInput);

    return await withTx(async (tx) => {
      const [ent] = await tx
        .select()
        .from(entitlements)
        .where(eq(entitlements.id, input.entitlementId));

      if (!ent) {
        throw new AppError(ErrorCode.NOT_FOUND, "Entitlement not found");
      }

      if (ctx.userId && ent.userId !== ctx.userId && !ctx.roles.includes("super_admin") && !ctx.roles.includes("admin")) {
        throw new AppError(ErrorCode.NOT_FOUND, "Entitlement not found");
      }

      if (ent.status !== "active") {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          `Cannot reveal license key when entitlement is '${ent.status}'`,
        );
      }

      if (!ent.licenseKeyEnc) {
        throw new AppError(ErrorCode.NOT_FOUND, "No license key has been set for this entitlement");
      }

      const licenseKey = decrypt(ent.licenseKeyEnc);

      await auditService.log(
        ctx,
        "license.revealed",
        { type: "entitlement", id: ent.id },
        null,
        { revealed: true },
        tx,
      );

      return { licenseKey };
    });
  }

  async listEntitlementsAdmin(
    ctx: RequestContext,
    rawInput: ListEntitlementsAdminInput,
  ): Promise<ListResult<EntitlementAdminRow>> {
    assertPermission(ctx, "delivery.tasks.write");
    const input = listEntitlementsAdminSchema.parse(rawInput);
    const db = await getDb();

    const conditions = [];
    if (input.filters.status && input.filters.status.length > 0) {
      conditions.push(inArray(entitlements.status, input.filters.status));
    }
    if (input.filters.deliveryType) {
      conditions.push(eq(entitlements.deliveryType, input.filters.deliveryType));
    }
    if (input.filters.productId) {
      conditions.push(eq(entitlements.productId, input.filters.productId));
    }
    if (input.filters.userId) {
      conditions.push(eq(entitlements.userId, input.filters.userId));
    }
    if (input.filters.provisioningState) {
      conditions.push(eq(entitlements.provisioningState, input.filters.provisioningState));
    }

    const rows = await db
      .select()
      .from(entitlements)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(entitlements.createdAt))
      .limit(input.limit + 1);

    const hasNext = rows.length > input.limit;
    const currentRows = hasNext ? rows.slice(0, input.limit) : rows;

    const items: EntitlementAdminRow[] = [];
    for (const r of currentRows) {
      items.push(await this.buildAdminRow(r, db as any));
    }

    return {
      items,
      nextCursor: hasNext ? currentRows[currentRows.length - 1]?.id ?? null : null,
    };
  }

  async getEntitlementAdmin(
    ctx: RequestContext,
    rawInput: GetEntitlementAdminInput,
  ): Promise<EntitlementAdminRow> {
    assertPermission(ctx, "delivery.tasks.write");
    const input = getEntitlementAdminSchema.parse(rawInput);
    const db = await getDb();

    const [ent] = await db
      .select()
      .from(entitlements)
      .where(eq(entitlements.id, input.entitlementId));

    if (!ent) {
      throw new AppError(ErrorCode.NOT_FOUND, "Entitlement not found");
    }

    return await this.buildAdminRow(ent, db as any);
  }

  async resetDownloadCount(
    ctx: RequestContext,
    rawInput: ResetDownloadCountInput,
  ): Promise<EntitlementAdminRow> {
    assertPermission(ctx, "entitlements.admin");
    const input = resetDownloadCountSchema.parse(rawInput);

    return await withTx(async (tx) => {
      const [ent] = await tx
        .select()
        .from(entitlements)
        .where(eq(entitlements.id, input.entitlementId))
        .for("update");

      if (!ent) {
        throw new AppError(ErrorCode.NOT_FOUND, "Entitlement not found");
      }

      const updateData: { downloadsUsed: number; downloadCap?: number; updatedAt: Date } = {
        downloadsUsed: 0,
        updatedAt: new Date(),
      };
      if (input.newCap !== undefined) {
        updateData.downloadCap = input.newCap;
      }

      const [updated] = await tx
        .update(entitlements)
        .set(updateData)
        .where(eq(entitlements.id, ent.id))
        .returning();

      await auditService.log(
        ctx,
        "entitlement.download_reset",
        { type: "entitlement", id: ent.id },
        { downloadsUsed: ent.downloadsUsed, downloadCap: ent.downloadCap },
        { downloadsUsed: updated!.downloadsUsed, downloadCap: updated!.downloadCap },
        tx,
      );

      return await this.buildAdminRow(updated!, tx);
    });
  }

  async extendAccess(
    ctx: RequestContext,
    rawInput: ExtendAccessInput,
  ): Promise<EntitlementAdminRow> {
    assertPermission(ctx, "entitlements.admin");
    const input = extendAccessSchema.parse(rawInput);

    return await withTx(async (tx) => {
      const [ent] = await tx
        .select()
        .from(entitlements)
        .where(eq(entitlements.id, input.entitlementId))
        .for("update");

      if (!ent) {
        throw new AppError(ErrorCode.NOT_FOUND, "Entitlement not found");
      }

      let updated = ent;

      if (input.accessEndsAt !== undefined) {
        const newEnds = input.accessEndsAt ? new Date(input.accessEndsAt) : null;
        const [res] = await tx
          .update(entitlements)
          .set({
            accessEndsAt: newEnds,
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(entitlements.id, ent.id))
          .returning();
        updated = res!;
      }

      if (input.periodEnd !== undefined) {
        const newPeriod = new Date(input.periodEnd);
        await tx
          .update(subscriptions)
          .set({
            currentPeriodEnd: newPeriod,
            status: "active",
            graceUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.entitlementId, ent.id));

        const [res] = await tx
          .update(entitlements)
          .set({
            accessEndsAt: newPeriod,
            status: "active",
            updatedAt: new Date(),
          })
          .where(eq(entitlements.id, ent.id))
          .returning();
        updated = res!;
      }

      await auditService.log(
        ctx,
        "entitlement.access_extended",
        { type: "entitlement", id: ent.id },
        { accessEndsAt: ent.accessEndsAt },
        { accessEndsAt: updated.accessEndsAt, reason: input.reason },
        tx,
      );

      return await this.buildAdminRow(updated, tx);
    });
  }

  async runExpireJob(job: JobContext): Promise<JobOutcome<{ expired: number }>> {
    return await withTx(async (tx) => {
      const now = job.now ?? new Date();

      // Only expire one-time entitlements with access_ends_at < now and status = 'active'
      // Subscription-backed entitlements are managed by the subscription cron
      const expiredRows = await tx
        .update(entitlements)
        .set({
          status: "expired",
          updatedAt: now,
        })
        .where(
          and(
            eq(entitlements.status, "active"),
            lte(entitlements.accessEndsAt, now),
            sql`NOT EXISTS (SELECT 1 FROM ${subscriptions} WHERE ${subscriptions.entitlementId} = ${entitlements.id})`,
          ),
        )
        .returning({ id: entitlements.id });

      return {
        ok: true,
        detail: {
          expired: expiredRows.length,
        },
      };
    });
  }

  private async buildCustomerView(ent: Entitlement, db: any): Promise<EntitlementView> {
    const [prod] = await db.select().from(products).where(eq(products.id, ent.productId));
    const [offering] = await db.select().from(offerings).where(eq(offerings.id, ent.offeringId));
    const [user] = await db.select().from(users).where(eq(users.id, ent.userId));

    let orderNo: string | null = null;
    let invoiceNo: string | null = null;
    if (ent.orderItemId) {
      const [item] = await db.select().from(orderItems).where(eq(orderItems.id, ent.orderItemId));
      if (item) {
        const [ord] = await db.select().from(orders).where(eq(orders.id, item.orderId));
        orderNo = ord?.orderNo ?? null;
        const [inv] = await db.select().from(invoices).where(eq(invoices.orderId, item.orderId));
        invoiceNo = inv?.invoiceNo ?? null;
      }
    }

    const [sub] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.entitlementId, ent.id));

    const progressRows = await db
      .select()
      .from(serviceProgress)
      .where(eq(serviceProgress.entitlementId, ent.id));

    const files = await db
      .select({
        rf: releaseFiles,
        med: media,
      })
      .from(releaseFiles)
      .innerJoin(media, eq(releaseFiles.mediaId, media.id))
      .where(eq(releaseFiles.productId, ent.productId));

    const openTasks = await db
      .select()
      .from(deliveryTasks)
      .where(and(eq(deliveryTasks.entitlementId, ent.id), eq(deliveryTasks.status, "open")));

    const handler = this.registry.get(ent.deliveryType);
    const handlerCtx = {
      actorId: null,
      requestId: "customer-view",
      offering: {
        id: offering!.id,
        name: offering!.name,
        deliveryConfig: offering!.deliveryConfig as any,
        serviceSteps: offering!.serviceSteps as any,
        purchaseModel: offering!.purchaseModel as any,
      },
      product: { id: prod!.id, name: prod!.name, slug: prod!.slug },
      customer: { id: user!.id, email: user!.email, name: user!.name },
      subscription: sub ?? null,
      manualGrant: ent.orderItemId === null,
    };

    const source = {
      entitlement: ent,
      ctx: handlerCtx,
      serviceProgress: progressRows,
      releaseFiles: files.map((f: any) => ({
        mediaId: f.rf.mediaId,
        version: f.rf.version,
        name: f.med.name,
        sizeBytes: f.med.sizeBytes,
        releasedAt: f.rf.releasedAt,
        notes: f.rf.notes,
      })),
      openTasks,
    };

    const cView = handler.customerView(source);

    const subscriptionView = sub
      ? {
          subscriptionId: sub.id,
          interval: sub.interval as any,
          status: sub.status as any,
          periodStart: sub.currentPeriodStart.toISOString(),
          periodEnd: sub.currentPeriodEnd.toISOString(),
          graceUntil: sub.graceUntil ? sub.graceUntil.toISOString() : null,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          renewalOrderNo: null,
          canRenew: sub.status === "active" || sub.status === "past_due",
        }
      : undefined;

    return {
      entitlementId: ent.id,
      product: { id: prod!.id, name: prod!.name, slug: prod!.slug, published: prod!.status === "published" },
      offering: { id: offering!.id, name: offering!.name },
      deliveryType: ent.deliveryType,
      status: ent.status,
      access: {
        startsAt: ent.accessStartsAt.toISOString(),
        endsAt: ent.accessEndsAt ? ent.accessEndsAt.toISOString() : null,
      },
      updatePolicy: ent.updatePolicy,
      orderNo,
      invoiceNo,
      grantedAt: ent.createdAt.toISOString(),
      instructionsHtml: null,
      versions: [],
      downloads: "downloads" in cView ? cView.downloads : undefined,
      licenseKeyMasked: "licenseKeyMasked" in cView ? cView.licenseKeyMasked : undefined,
      provisioning: "provisioning" in cView ? cView.provisioning : undefined,
      serviceProgress: "serviceProgress" in cView ? cView.serviceProgress : undefined,
      custom: "custom" in cView ? cView.custom : undefined,
      subscription: subscriptionView,
    };
  }

  private async buildAdminRow(ent: Entitlement, tx: TxCtx): Promise<EntitlementAdminRow> {
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

export const entitlementsService = new DefaultEntitlementsService();

export function createNotImplementedEntitlementsService(): EntitlementsService {
  return createNotImplemented<EntitlementsService>("entitlements", "P5", {
    grantEntitlement: "async",
    grantForOrder: "async",
    revokeEntitlement: "async",
    revoke: "async",
    resetDownloadCount: "async",
    issueDownloadLink: "async",
    revealLicenseKey: "async",
    extendAccess: "async",
    listEntitlements: "async",
    getEntitlementView: "async",
    checkEntitlementAccess: "async",
  });
}
