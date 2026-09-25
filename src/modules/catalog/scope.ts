/**
 * Product write guards shared by catalog and offerings (docs/06 §1.2 D-512 `own_products`,
 * API-CAT-02 `STATE_INVALID` on archived). The `admin` role is scoped to products where its
 * partner holds an ownership line (any version) or which it created (drafts before P3.8's initial
 * ownership exists); `super_admin` / `staff` are unscoped (`productScope`).
 */
import { and, eq, exists, or, sql, type SQL } from "drizzle-orm";
import type { RequestContext } from "@/lib/authz/context";
import { isUnscoped, productScope } from "@/lib/authz/scope";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { type Product, products } from "../../../drizzle/schema/catalog";
import { productOwnershipLines, productOwnerships } from "../../../drizzle/schema/ownership";

/** SQL predicate restricting `products` rows to the caller's scope, or `undefined` when unscoped. */
export function productScopeCondition(ctx: RequestContext, db: DbOrTx): SQL | undefined {
  const scope = productScope(ctx);
  if (isUnscoped(scope)) return undefined;
  return or(
    eq(products.createdBy, ctx.userId),
    exists(
      db
        .select({ one: sql`1` })
        .from(productOwnershipLines)
        .innerJoin(productOwnerships, eq(productOwnerships.id, productOwnershipLines.ownershipId))
        .where(
          and(
            eq(productOwnerships.productId, products.id),
            eq(productOwnershipLines.partnerId, scope.partnerId),
          ),
        ),
    ),
  );
}

export async function isProductInScope(
  ctx: RequestContext,
  productId: string,
  db: DbOrTx,
): Promise<boolean> {
  const scope = productScope(ctx);
  if (isUnscoped(scope)) return true;
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), productScopeCondition(ctx, db)))
    .limit(1);
  return row !== undefined;
}

export interface LoadForWriteOptions {
  /** Default `true`: `archived` products refuse edits with `STATE_INVALID`. */
  refuseArchived?: boolean;
}

/** Lock the product row, then `NOT_FOUND` → scope `FORBIDDEN` → archived `STATE_INVALID`. */
export async function loadProductForWrite(
  ctx: RequestContext,
  productId: string,
  tx: TxCtx,
  options: LoadForWriteOptions = {},
): Promise<Product> {
  const [row] = await tx.select().from(products).where(eq(products.id, productId)).for("update");
  if (row === undefined) throw new AppError(ErrorCode.NOT_FOUND, "Product not found.");
  if (!(await isProductInScope(ctx, productId, tx))) {
    throw new AppError(ErrorCode.FORBIDDEN, undefined, { cause: { scope: "product" } });
  }
  if (options.refuseArchived !== false && row.status === "archived") {
    throw new AppError(ErrorCode.STATE_INVALID, "Archived products cannot be edited.");
  }
  return row;
}
