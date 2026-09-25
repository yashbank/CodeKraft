/**
 * Admin data scope for entitlements — docs/06 §1.2 (`delivery.tasks.write` / `entitlements.admin`
 * are ◐ "own products" for the `admin` role, D-512). `super_admin`/`staff` are unscoped; an
 * `admin` sees products where their partner holds a line on the `active` or `pending` ownership
 * version. Applied in SQL (docs/09 §4.2), never by filtering loaded rows.
 */
import { and, eq, exists, inArray, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import type { Context } from "@/lib/authz/context";
import { type PartnerScope, productScope } from "@/lib/authz/scope";
import { AppError, ErrorCode } from "@/lib/errors";
import type { TxCtx } from "@/lib/db";
import { productOwnershipLines, productOwnerships } from "../../../drizzle/schema/ownership";

const IN_SCOPE_STATUSES = ["active", "pending"] as const;

/** `exists (...)` predicate restricting `productIdColumn` to the caller's partner products; `undefined` when unscoped. */
export function productScopeCondition(
  scope: PartnerScope,
  productIdColumn: PgColumn,
): SQL | undefined {
  if (scope === "all") return undefined;
  return exists(
    sql`(select 1 from ${productOwnerships} inner join ${productOwnershipLines} on ${productOwnershipLines.ownershipId} = ${productOwnerships.id} where ${productOwnerships.productId} = ${productIdColumn} and ${productOwnershipLines.partnerId} = ${scope.partnerId} and ${productOwnerships.status} in ('active', 'pending'))`,
  );
}

/** Resolve the caller's product scope (throws `FORBIDDEN` for non-admin-class callers). */
export function resolveProductScope(ctx: Context): PartnerScope {
  return productScope(ctx);
}

/** Throw `FORBIDDEN` unless `productId` is inside the caller's scope. */
export async function assertProductInScope(
  ctx: Context,
  productId: string,
  tx: TxCtx,
): Promise<void> {
  const scope = productScope(ctx);
  if (scope === "all") return;
  const [row] = await tx
    .select({ id: productOwnerships.id })
    .from(productOwnerships)
    .innerJoin(productOwnershipLines, eq(productOwnershipLines.ownershipId, productOwnerships.id))
    .where(
      and(
        eq(productOwnerships.productId, productId),
        eq(productOwnershipLines.partnerId, scope.partnerId),
        inArray(productOwnerships.status, [...IN_SCOPE_STATUSES]),
      ),
    )
    .limit(1);
  if (row === undefined) {
    throw new AppError(ErrorCode.FORBIDDEN, undefined, { cause: { scope: "product", productId } });
  }
}
