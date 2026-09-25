/**
 * `coupons` service — PHASE-04 P4.3 (docs/06 API-COM-08; validation behind API-COM-01/02; TM-06).
 * Redemptions are counted at `paid` under `SELECT … FOR UPDATE` on the coupon row, so a race for
 * the last redemption yields exactly one (`LIMIT_EXCEEDED` for the loser).
 */
import { and, asc, desc, eq, gt, inArray, lt, or, type SQL, sql } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import { type TxCtx, type TxRunner, getDb, withTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import type { AuditService } from "@/modules/audit/contracts";
import type { ListResult } from "@/modules/_shared/zod";
import { type Coupon, couponRedemptions, coupons, orders } from "../../../drizzle/schema/commerce";
import type { CouponsService } from "./contracts";
import { type CouponValidation, type ListCouponsInput, type UpsertCouponInput, type ValidateCouponInput } from "./types";
import { evaluateCoupon } from "./validate";

export interface CouponsServiceDeps {
  db: TxRunner;
  audit: Pick<AuditService, "log">;
  now?: () => Date;
}

/** Admin-created codes must be at least 8 characters (P4.3). */
export const MIN_ADMIN_CODE_LENGTH = 8;

const PAID_STATUSES = ["paid", "fulfilled", "refunded", "partially_refunded"] as const;

function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err; e instanceof Error; e = e.cause) {
    if ((e as { code?: string }).code === "23505") return true;
  }
  return false;
}

export function createCouponsService(deps: CouponsServiceDeps): CouponsService {
  const now = deps.now ?? (() => new Date());

  async function findByCode(code: string, tx: TxCtx): Promise<Coupon | null> {
    const [row] = await tx.select().from(coupons).where(eq(coupons.code, code)).limit(1);
    return row ?? null;
  }

  async function buyerPaidOrders(userId: string | null, tx: TxCtx): Promise<number> {
    if (userId === null) return 0;
    const [row] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.userId, userId), inArray(orders.status, [...PAID_STATUSES])));
    return row?.n ?? 0;
  }

  return {
    async upsertCoupon(ctx: RequestContext, input: UpsertCouponInput, outerTx) {
      return withTx(async (tx) => {
        if (input.code.length < MIN_ADMIN_CODE_LENGTH) {
          throw new AppError(ErrorCode.VALIDATION, undefined, {
            fieldErrors: { code: [`codes must be at least ${String(MIN_ADMIN_CODE_LENGTH)} characters`] },
          });
        }
        const values = {
          code: input.code,
          kind: input.kind,
          value: input.value,
          currency: input.kind === "fixed" ? (input.currency ?? null) : null,
          startsAt: input.startsAt === undefined ? null : new Date(input.startsAt),
          endsAt: input.endsAt === undefined ? null : new Date(input.endsAt),
          maxRedemptions: input.maxRedemptions ?? null,
          firstPurchaseOnly: input.firstPurchaseOnly,
          productIds: input.productIds ?? null,
          active: input.active,
        };
        let before: Coupon | null = null;
        let coupon: Coupon | undefined;
        try {
          if (input.id !== undefined) {
            const [existing] = await tx.select().from(coupons).where(eq(coupons.id, input.id)).limit(1);
            if (existing === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Coupon not found.");
            before = existing;
            [coupon] = await tx.update(coupons).set(values).where(eq(coupons.id, input.id)).returning();
          } else {
            [coupon] = await tx.insert(coupons).values({ ...values, createdBy: ctx.userId }).returning();
          }
        } catch (err) {
          if (isUniqueViolation(err)) throw new AppError(ErrorCode.CONFLICT, "A coupon with this code already exists.");
          throw err;
        }
        if (coupon === undefined) throw new Error("coupon upsert returned no row");
        await deps.audit.log(ctx, "API-COM-08 coupon.upsert", { type: "coupon", id: coupon.id }, before, coupon, tx);
        return { coupon };
      }, outerTx, deps.db);
    },

    async deactivateCoupon(ctx, input, outerTx) {
      return withTx(async (tx) => {
        const [before] = await tx.select().from(coupons).where(eq(coupons.id, input.id)).limit(1);
        if (before === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Coupon not found.");
        const [coupon] = await tx.update(coupons).set({ active: false }).where(eq(coupons.id, input.id)).returning();
        if (coupon === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Coupon not found.");
        await deps.audit.log(ctx, "API-COM-08 coupon.deactivate", { type: "coupon", id: coupon.id }, { active: before.active }, { active: false }, tx);
        return { coupon };
      }, outerTx, deps.db);
    },

    async listCoupons(_ctx, input: ListCouponsInput): Promise<ListResult<Coupon>> {
      return withTx(async (tx) => {
        const conditions: SQL[] = [];
        if (input.filters?.active !== undefined) conditions.push(eq(coupons.active, input.filters.active));
        if (input.filters?.kind !== undefined) conditions.push(eq(coupons.kind, input.filters.kind));
        if (input.q !== undefined && input.q !== "") conditions.push(sql`${coupons.code}::text ilike ${`%${input.q}%`}`);
        const [field, dirRaw] = (input.sort ?? "createdAt:desc").split(":");
        const dir = dirRaw === "asc" ? "asc" : "desc";
        const column = field === "code" ? coupons.code : field === "endsAt" ? coupons.endsAt : coupons.createdAt;
        if (input.cursor !== undefined) {
          const decoded = JSON.parse(Buffer.from(input.cursor, "base64url").toString("utf8")) as [string, string];
          const value = field === "code" ? decoded[0] : new Date(decoded[0]);
          const cmp = dir === "asc" ? gt : lt;
          const cond = or(cmp(column, value as never), and(eq(column, value as never), cmp(coupons.id, decoded[1])));
          if (cond !== undefined) conditions.push(cond);
        }
        const rows = await tx
          .select()
          .from(coupons)
          .where(conditions.length === 0 ? undefined : and(...conditions))
          .orderBy(dir === "asc" ? asc(column) : desc(column), dir === "asc" ? asc(coupons.id) : desc(coupons.id))
          .limit(input.limit + 1);
        const items = rows.slice(0, input.limit);
        const last = items[items.length - 1];
        const lastValue =
          last === undefined ? null : field === "code" ? last.code : ((field === "endsAt" ? last.endsAt : last.createdAt)?.toISOString() ?? null);
        return {
          items,
          nextCursor:
            rows.length > input.limit && last !== undefined
              ? Buffer.from(JSON.stringify([lastValue, last.id]), "utf8").toString("base64url")
              : null,
        };
      }, undefined, deps.db);
    },

    async validateForOrder(input: ValidateCouponInput, outerTx): Promise<CouponValidation> {
      return withTx(async (tx) => {
        const coupon = await findByCode(input.code, tx);
        return evaluateCoupon(coupon, {
          at: input.at === undefined ? now() : new Date(input.at),
          buyerPaidOrders: await buyerPaidOrders(input.userId, tx),
          productId: input.productId,
          subtotal: input.subtotal,
        });
      }, outerTx, deps.db);
    },

    async redeemForOrder(couponId, orderId, userId, tx): Promise<void> {
      const [locked] = await tx.select().from(coupons).where(eq(coupons.id, couponId)).for("update").limit(1);
      if (locked === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Coupon not found.");
      const [already] = await tx
        .select({ id: couponRedemptions.id })
        .from(couponRedemptions)
        .where(and(eq(couponRedemptions.couponId, couponId), eq(couponRedemptions.orderId, orderId)))
        .limit(1);
      if (already !== undefined) return; // idempotent per (coupon, order)
      const [updated] = await tx
        .update(coupons)
        .set({ redemptionsCount: sql`${coupons.redemptionsCount} + 1` })
        .where(
          and(
            eq(coupons.id, couponId),
            or(sql`${coupons.maxRedemptions} is null`, sql`${coupons.redemptionsCount} < ${coupons.maxRedemptions}`),
          ),
        )
        .returning({ id: coupons.id });
      if (updated === undefined) {
        throw new AppError(
          ErrorCode.LIMIT_EXCEEDED,
          `Coupon ${locked.code} is exhausted; confirm the payment without the coupon.`,
        );
      }
      await tx.insert(couponRedemptions).values({ couponId, orderId, userId });
    },
  };
}

import * as auditModule from "@/modules/audit/service";
import { lazyService, resolveSingleton } from "@/modules/orders/deps";

export const couponsService: CouponsService = createCouponsService({
  db: lazyService<TxRunner>(() => getDb()),
  audit: lazyService(() => resolveSingleton<AuditService>(auditModule, "auditService", auditModule.createNotImplementedAuditService)),
});
