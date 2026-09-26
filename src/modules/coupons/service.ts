/**
 * Coupons service implementation (docs/06 §2.3 API-COM-08, master plan §5, P4.3).
 */
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { type DbOrTx, type TxCtx, getDb, withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import { couponRedemptions, coupons, orders } from "../../../drizzle/schema/commerce";
import type { CouponsService } from "./contracts";
import {
  type Coupon,
  type CouponValidation,
  type DeactivateCouponInput,
  type ListCouponsInput,
  type UpsertCouponInput,
  type ValidateCouponInput,
  computeCouponDiscount,
} from "./types";
import type { ListResult } from "@/modules/_shared/zod";

export class DefaultCouponsService implements CouponsService {
  async upsertCoupon(
    ctx: RequestContext,
    input: UpsertCouponInput,
    tx?: TxCtx,
  ): Promise<{ coupon: Coupon }> {
    assertPermission(ctx, "orders.manual.write");

    if (input.code.length < 8) {
      throw new AppError(ErrorCode.VALIDATION, "Coupon code must be at least 8 characters");
    }

    const runner = async (activeTx: TxCtx): Promise<{ coupon: Coupon }> => {
      // Check code uniqueness
      const [existingByCode] = await activeTx
        .select({ id: coupons.id })
        .from(coupons)
        .where(sql`lower(${coupons.code}) = lower(${input.code})`)
        .limit(1);

      if (existingByCode && (!input.id || existingByCode.id !== input.id)) {
        throw new AppError(ErrorCode.CONFLICT, "Coupon code already exists");
      }

      if (input.id) {
        const [existing] = await activeTx
          .select()
          .from(coupons)
          .where(eq(coupons.id, input.id))
          .limit(1);

        if (!existing) {
          throw new AppError(ErrorCode.NOT_FOUND, "Coupon not found");
        }

        const [updated] = await activeTx
          .update(coupons)
          .set({
            code: input.code,
            kind: input.kind,
            value: input.value,
            currency: input.currency ?? null,
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            maxRedemptions: input.maxRedemptions ?? null,
            firstPurchaseOnly: input.firstPurchaseOnly,
            productIds: input.productIds ?? null,
            active: input.active,
          })
          .where(eq(coupons.id, input.id))
          .returning();

        if (!updated) {
          throw new AppError(ErrorCode.INTERNAL, "Failed to update coupon");
        }

        await auditService.log(
          ctx,
          "coupon.updated",
          { type: "coupon", id: updated.id },
          existing,
          updated,
          activeTx,
        );

        return { coupon: updated };
      } else {
        const [created] = await activeTx
          .insert(coupons)
          .values({
            code: input.code,
            kind: input.kind,
            value: input.value,
            currency: input.currency ?? null,
            startsAt: input.startsAt ? new Date(input.startsAt) : null,
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            maxRedemptions: input.maxRedemptions ?? null,
            firstPurchaseOnly: input.firstPurchaseOnly,
            productIds: input.productIds ?? null,
            active: input.active,
            createdBy: ctx.userId,
          })
          .returning();

        if (!created) {
          throw new AppError(ErrorCode.INTERNAL, "Failed to create coupon");
        }

        await auditService.log(
          ctx,
          "coupon.created",
          { type: "coupon", id: created.id },
          null,
          created,
          activeTx,
        );

        return { coupon: created };
      }
    };

    if (tx) {
      return await runner(tx);
    }
    return await withTx(runner);
  }

  async deactivateCoupon(
    ctx: RequestContext,
    input: DeactivateCouponInput,
    tx?: TxCtx,
  ): Promise<{ coupon: Coupon }> {
    assertPermission(ctx, "orders.manual.write");

    const runner = async (activeTx: TxCtx): Promise<{ coupon: Coupon }> => {
      const [existing] = await activeTx
        .select()
        .from(coupons)
        .where(eq(coupons.id, input.id))
        .limit(1);

      if (!existing) {
        throw new AppError(ErrorCode.NOT_FOUND, "Coupon not found");
      }

      const [updated] = await activeTx
        .update(coupons)
        .set({ active: false })
        .where(eq(coupons.id, input.id))
        .returning();

      if (!updated) {
        throw new AppError(ErrorCode.INTERNAL, "Failed to deactivate coupon");
      }

      await auditService.log(
        ctx,
        "coupon.deactivated",
        { type: "coupon", id: updated.id },
        existing,
        updated,
        activeTx,
      );

      return { coupon: updated };
    };

    if (tx) {
      return await runner(tx);
    }
    return await withTx(runner);
  }

  async listCoupons(
    ctx: RequestContext,
    input: ListCouponsInput,
  ): Promise<ListResult<Coupon>> {
    assertPermission(ctx, "orders.manual.write");
    const db = await getDb();

    const conditions = [];
    if (input.filters?.active !== undefined) {
      conditions.push(eq(coupons.active, input.filters.active));
    }
    if (input.filters?.kind !== undefined) {
      conditions.push(eq(coupons.kind, input.filters.kind));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const pageSize = input.limit ?? 25;

    let sortCol = coupons.createdAt;
    let isAsc = false;
    if (input.sort) {
      const [col, dir] = input.sort.split(":");
      if (col === "code") sortCol = coupons.code as any;
      if (col === "endsAt") sortCol = coupons.endsAt as any;
      if (dir === "asc") isAsc = true;
    }
    const orderClause = isAsc ? asc(sortCol) : desc(sortCol);

    const rows = await db
      .select()
      .from(coupons)
      .where(whereClause)
      .orderBy(orderClause)
      .limit(pageSize);

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(coupons)
      .where(whereClause);

    return {
      items: rows,
      total: totalRow?.count ?? rows.length,
      nextCursor: null,
    };
  }

  async validateForOrder(
    input: ValidateCouponInput,
    tx?: TxCtx,
  ): Promise<CouponValidation> {
    const db: DbOrTx = tx ?? (await getDb());

    const [coupon] = await db
      .select()
      .from(coupons)
      .where(sql`lower(${coupons.code}) = lower(${input.code})`)
      .limit(1);

    if (!coupon) {
      return { valid: false, reason: "not_found" };
    }

    if (!coupon.active) {
      return { valid: false, reason: "inactive" };
    }

    const at = input.at ? new Date(input.at) : new Date();

    if (coupon.startsAt && coupon.startsAt > at) {
      return { valid: false, reason: "not_started" };
    }

    if (coupon.endsAt && coupon.endsAt <= at) {
      return { valid: false, reason: "expired" };
    }

    if (coupon.maxRedemptions !== null && coupon.redemptionsCount >= coupon.maxRedemptions) {
      return { valid: false, reason: "exhausted" };
    }

    if (coupon.kind === "fixed" && coupon.currency && coupon.currency !== input.subtotal.currency) {
      return { valid: false, reason: "currency_mismatch" };
    }

    if (coupon.productIds && coupon.productIds.length > 0) {
      if (!coupon.productIds.includes(input.productId)) {
        return { valid: false, reason: "product_restricted" };
      }
    }

    if (coupon.firstPurchaseOnly) {
      if (!input.userId) {
        return { valid: false, reason: "first_purchase_only" };
      }

      const [priorPaidOrder] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(
          and(
            eq(orders.userId, input.userId),
            inArray(orders.status, ["paid", "fulfilled", "partially_refunded", "refunded"]),
          ),
        )
        .limit(1);

      if (priorPaidOrder) {
        return { valid: false, reason: "first_purchase_only" };
      }
    }

    const discountMinor = computeCouponDiscount(coupon.kind, coupon.value, input.subtotal);

    return {
      valid: true,
      coupon: {
        id: coupon.id,
        code: coupon.code,
        kind: coupon.kind,
        value: coupon.value,
      },
      discountMinor,
    };
  }

  async redeemForOrder(
    couponId: string,
    orderId: string,
    userId: string | null,
    outerTx?: TxCtx,
  ): Promise<void> {
    const runner = async (tx: TxCtx): Promise<void> => {
      // Lock coupon row for update
      const [coupon] = await tx
        .select()
        .from(coupons)
        .where(eq(coupons.id, couponId))
        .for("update");

      if (!coupon) {
        throw new AppError(ErrorCode.NOT_FOUND, "Coupon not found");
      }

      if (coupon.maxRedemptions !== null && coupon.redemptionsCount >= coupon.maxRedemptions) {
        throw new AppError(ErrorCode.LIMIT_EXCEEDED, "Coupon redemptions limit exceeded");
      }

      await tx
        .insert(couponRedemptions)
        .values({
          couponId,
          orderId,
          userId,
        })
        .onConflictDoNothing();

      await tx
        .update(coupons)
        .set({
          redemptionsCount: sql`${coupons.redemptionsCount} + 1`,
        })
        .where(eq(coupons.id, couponId));
    };

    if (outerTx) return await runner(outerTx);
    return await withTx(runner);
  }
}

export const couponsService: CouponsService = new DefaultCouponsService();

/** Preserved for freeze tests (PHASE-02 P2.8). */
export function createNotImplementedCouponsService(): CouponsService {
  return createNotImplemented<CouponsService>("coupons", "P4", {
    upsertCoupon: "async",
    deactivateCoupon: "async",
    listCoupons: "async",
    validateForOrder: "async",
    redeemForOrder: "async",
  });
}
