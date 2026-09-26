/**
 * Ownership service implementation (docs/05 §4, docs/06 API-CAT-16/17, BR-05/06/07, PHASE-03 P3.8).
 * Full implementation satisfying OwnershipService contracts.
 */
import { and, desc, eq, inArray, lte, sql } from "drizzle-orm";
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { DbOrTx, TxCtx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { auditService } from "@/modules/audit/service";
import { approvalsService } from "@/modules/approvals/service";
import type { ListResult } from "@/modules/_shared/zod";
import { productOwnerships, productOwnershipLines } from "../../../drizzle/schema/ownership";
import { products } from "../../../drizzle/schema/catalog";
import { partners } from "../../../drizzle/schema/users-ext";
import { users } from "../../../drizzle/schema/auth";
import type { z } from "zod";
import {
  type OwnershipService,
  type ProposeOwnershipInput,
  type ProposeOwnershipResult,
  listOwnershipVersionsSchema,
  sumsToTotal,
} from "./contracts";
import { OWNERSHIP_TOTAL_BPS } from "./types";
import type { OwnershipChangePayload, OwnershipSummary, OwnershipVersionView } from "./types";

export class DefaultOwnershipService implements OwnershipService {
  constructor(private readonly getDb?: () => DbOrTx) {}

  private async getDatabase(tx?: DbOrTx): Promise<DbOrTx> {
    if (tx) return tx;
    if (this.getDb) return this.getDb();
    const { db } = await import("@/lib/db");
    return db;
  }

  /**
   * API-CAT-16: Propose ownership version with dual approval request.
   */
  async proposeOwnership(
    ctx: RequestContext,
    input: ProposeOwnershipInput,
    tx?: DbOrTx,
  ): Promise<ProposeOwnershipResult> {
    assertPermission(ctx, "ownership.propose");
    const { withTx } = await import("@/lib/db");
    const outerTx = tx && !("$client" in tx) ? (tx as TxCtx) : undefined;

    return await withTx(async (actionTx) => {
      // 1. Verify product exists
      const [product] = await actionTx
        .select()
        .from(products)
        .where(eq(products.id, input.productId))
        .limit(1);

      if (!product) {
        throw new AppError(ErrorCode.NOT_FOUND, "Product not found");
      }

      // Partner scoping: admin role can only propose for own products
      const isSuperAdmin = ctx.roles.includes("super_admin");
      if (!isSuperAdmin && product.createdBy !== ctx.userId) {
        throw new AppError(
          ErrorCode.FORBIDDEN,
          "You can only propose ownership splits for products you created",
        );
      }

      // 2. Validate total bps sum == 10000 (BR-06, BR-07, sumsToTotal)
      if (!sumsToTotal(input.lines)) {
        const linesSum = input.lines.reduce((acc, l) => acc + l.shareBps, 0);
        throw new AppError(
          ErrorCode.VALIDATION,
          `Ownership partner shares must sum to exactly 10,000 bps (got ${linesSum})`,
        );
      }

      // 3. Verify all partners exist and are active in partners table
      const partnerIds = input.lines.map((l) => l.partnerId);
      const activePartners = await actionTx
        .select({ id: partners.id, userId: partners.userId, active: partners.active })
        .from(partners)
        .where(inArray(partners.id, partnerIds));

      if (activePartners.length !== partnerIds.length) {
        throw new AppError(
          ErrorCode.VALIDATION,
          "One or more partner IDs in the proposal do not exist",
        );
      }

      const inactive = activePartners.filter((p) => !p.active);
      if (inactive.length > 0) {
        throw new AppError(
          ErrorCode.VALIDATION,
          "Cannot assign ownership shares to inactive or suspended partners",
        );
      }

      // 4. Check no other pending version exists for this product
      const [pendingExisting] = await actionTx
        .select({ id: productOwnerships.id })
        .from(productOwnerships)
        .where(
          and(
            eq(productOwnerships.productId, input.productId),
            eq(productOwnerships.status, "pending"),
          ),
        )
        .limit(1);

      if (pendingExisting) {
        throw new AppError(
          ErrorCode.STATE_INVALID,
          "A pending ownership version already exists for this product",
        );
      }

      // 5. Compute version n+1
      const [maxVerRow] = await actionTx
        .select({ max: sql<number>`coalesce(max(${productOwnerships.version}), 0)::int` })
        .from(productOwnerships)
        .where(eq(productOwnerships.productId, input.productId));

      const nextVersion = (maxVerRow?.max ?? 0) + 1;

      // 6. Insert pending ownership row
      const [newOwnership] = await actionTx
        .insert(productOwnerships)
        .values({
          productId: input.productId,
          version: nextVersion,
          status: "pending",
          companyCutBps: input.companyCutBps,
          effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
          createdBy: ctx.userId,
        })
        .returning();

      if (!newOwnership) {
        throw new AppError(ErrorCode.INTERNAL, "Failed to insert ownership version");
      }

      // 7. Insert lines
      await actionTx.insert(productOwnershipLines).values(
        input.lines.map((l) => ({
          ownershipId: newOwnership.id,
          partnerId: l.partnerId,
          shareBps: l.shareBps,
        })),
      );

      // 8. Create approval request
      const req = await approvalsService.request(
        "ownership.change",
        { type: "ownership", id: newOwnership.id },
        {
          ownershipId: newOwnership.id,
          productId: input.productId,
        },
        ctx.userId,
        actionTx,
      );

      // Link approvalRequestId to ownership row
      await actionTx
        .update(productOwnerships)
        .set({ approvalRequestId: req.approvalRequestId })
        .where(eq(productOwnerships.id, newOwnership.id));

      await auditService.log(
        ctx,
        "ownership.proposed",
        { type: "ownership", id: newOwnership.id },
        null,
        {
          id: newOwnership.id,
          version: nextVersion,
          companyCutBps: input.companyCutBps,
          lines: input.lines,
        },
        actionTx as TxCtx,
      );

      return {
        ownershipId: newOwnership.id,
        approvalRequestId: req.approvalRequestId,
      };
    }, outerTx);
  }

  /**
   * API-CAT-17: Internal apply handler for ownership.change.
   */
  async applyOwnershipChange(payload: OwnershipChangePayload, tx: TxCtx): Promise<void> {
    const [target] = await tx
      .select({
        id: productOwnerships.id,
        productId: productOwnerships.productId,
        effectiveFrom: productOwnerships.effectiveFrom,
      })
      .from(productOwnerships)
      .where(eq(productOwnerships.id, payload.ownershipId))
      .limit(1);

    if (!target) return;

    const prodId = payload.productId ?? target.productId;
    const now = new Date();
    let eff = now;
    if (target.effectiveFrom && target.effectiveFrom > now) {
      eff = target.effectiveFrom;
    }

    // Previous active version -> superseded
    await tx
      .update(productOwnerships)
      .set({ status: "superseded" })
      .where(and(eq(productOwnerships.productId, prodId), eq(productOwnerships.status, "active")));

    // New version -> active
    await tx
      .update(productOwnerships)
      .set({
        status: "active",
        effectiveFrom: eff,
      })
      .where(eq(productOwnerships.id, payload.ownershipId));

    // BR-05: Existing allocations rows are untouched
  }

  /**
   * Internal reject handler for ownership.change: deletes pending version and lines.
   */
  async onOwnershipChangeRejected(payload: OwnershipChangePayload, tx: TxCtx): Promise<void> {
    await tx
      .delete(productOwnershipLines)
      .where(eq(productOwnershipLines.ownershipId, payload.ownershipId));

    await tx.delete(productOwnerships).where(eq(productOwnerships.id, payload.ownershipId));
  }

  /**
   * API-CAT-01: Initial v1 pending ownership (100% to creator partner).
   */
  async createInitial(
    productId: string,
    creatorPartnerId: string | null,
    tx: TxCtx,
  ): Promise<void> {
    if (!creatorPartnerId) return;

    const [existing] = await tx
      .select({ id: productOwnerships.id })
      .from(productOwnerships)
      .where(eq(productOwnerships.productId, productId))
      .limit(1);

    if (existing) return;

    const [partnerRow] = await tx
      .select({ userId: partners.userId })
      .from(partners)
      .where(eq(partners.id, creatorPartnerId))
      .limit(1);

    const [own] = await tx
      .insert(productOwnerships)
      .values({
        productId,
        version: 1,
        status: "pending",
        companyCutBps: 0,
        createdBy: partnerRow?.userId ?? creatorPartnerId,
      })
      .returning();

    if (own) {
      await tx.insert(productOwnershipLines).values({
        ownershipId: own.id,
        partnerId: creatorPartnerId,
        shareBps: OWNERSHIP_TOTAL_BPS,
      });
    }
  }

  /**
   * API-CAT-12: Activates pending version for product publish.
   */
  async activateForPublish(productId: string, tx: TxCtx): Promise<void> {
    const [active] = await tx
      .select({ id: productOwnerships.id })
      .from(productOwnerships)
      .where(
        and(eq(productOwnerships.productId, productId), eq(productOwnerships.status, "active")),
      )
      .limit(1);

    if (active) return;

    const [pending] = await tx
      .select({
        id: productOwnerships.id,
        approvalRequestId: productOwnerships.approvalRequestId,
      })
      .from(productOwnerships)
      .where(
        and(eq(productOwnerships.productId, productId), eq(productOwnerships.status, "pending")),
      )
      .limit(1);

    if (!pending) {
      throw new AppError(
        ErrorCode.STATE_INVALID,
        "Cannot publish product: no active or pending ownership version exists",
      );
    }

    if (pending.approvalRequestId) {
      throw new AppError(
        ErrorCode.STATE_INVALID,
        `Cannot publish product: ownership approval request ${pending.approvalRequestId} is still pending`,
      );
    }

    await tx
      .update(productOwnerships)
      .set({
        status: "active",
        effectiveFrom: new Date(),
      })
      .where(eq(productOwnerships.id, pending.id));
  }

  /**
   * Version active at a given point in time (for finance allocations).
   */
  async getActiveAt(
    productId: string,
    at: Date = new Date(),
    tx?: DbOrTx,
  ): Promise<OwnershipVersionView | null> {
    const dbClient = await this.getDatabase(tx);

    const rows = await dbClient
      .select({
        ownership: productOwnerships,
        creator: users,
      })
      .from(productOwnerships)
      .leftJoin(users, eq(productOwnerships.createdBy, users.id))
      .where(
        and(
          eq(productOwnerships.productId, productId),
          inArray(productOwnerships.status, ["active", "superseded"]),
          lte(productOwnerships.effectiveFrom, at instanceof Date ? at : new Date(at)),
        ),
      )
      .orderBy(desc(productOwnerships.effectiveFrom), desc(productOwnerships.version))
      .limit(1);

    const match = rows[0];
    if (!match) {
      // Fall back to current active version if effectiveFrom is slightly ahead
      const [currentActive] = await dbClient
        .select({
          ownership: productOwnerships,
          creator: users,
        })
        .from(productOwnerships)
        .leftJoin(users, eq(productOwnerships.createdBy, users.id))
        .where(
          and(eq(productOwnerships.productId, productId), eq(productOwnerships.status, "active")),
        )
        .limit(1);

      if (!currentActive) return null;
      return await this.buildVersionView(currentActive.ownership, currentActive.creator, dbClient);
    }

    return await this.buildVersionView(match.ownership, match.creator, dbClient);
  }

  /**
   * Admin list of ownership versions for product.
   */
  async listVersions(
    ctx: RequestContext,
    input: z.infer<typeof listOwnershipVersionsSchema>,
    tx?: DbOrTx,
  ): Promise<ListResult<OwnershipVersionView>> {
    assertPermission(ctx, "catalog.read");
    const dbClient = await this.getDatabase(tx);

    const limit = input.limit ?? 20;
    const productId = input.filters?.productId;
    if (!productId) {
      throw new AppError(ErrorCode.VALIDATION, "productId filter is required");
    }

    const conditions = [eq(productOwnerships.productId, productId)];
    if (input.filters?.status) {
      conditions.push(eq(productOwnerships.status, input.filters.status));
    }

    const rows = await dbClient
      .select({
        ownership: productOwnerships,
        creator: users,
      })
      .from(productOwnerships)
      .leftJoin(users, eq(productOwnerships.createdBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(productOwnerships.version))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    const views: OwnershipVersionView[] = [];
    for (const r of items) {
      views.push(await this.buildVersionView(r.ownership, r.creator, dbClient));
    }

    const lastItem = items[items.length - 1];
    return {
      items: views,
      nextCursor: hasMore && lastItem ? String(lastItem.ownership.version) : null,
    };
  }

  /**
   * Summary for API-CAT-18 rows (active, else latest pending).
   */
  async summaryFor(
    productIds: readonly string[],
    tx?: DbOrTx,
  ): Promise<Map<string, OwnershipSummary>> {
    const dbClient = await this.getDatabase(tx);
    const result = new Map<string, OwnershipSummary>();
    if (productIds.length === 0) return result;

    const rows = await dbClient
      .select()
      .from(productOwnerships)
      .where(inArray(productOwnerships.productId, [...productIds]))
      .orderBy(desc(productOwnerships.version));

    for (const pid of productIds) {
      const pRows = rows.filter((r) => r.productId === pid);
      const active = pRows.find((r) => r.status === "active") ?? pRows[0];
      if (active) {
        const lineRows = await dbClient
          .select({
            partnerId: productOwnershipLines.partnerId,
            shareBps: productOwnershipLines.shareBps,
            userName: users.name,
          })
          .from(productOwnershipLines)
          .leftJoin(partners, eq(productOwnershipLines.partnerId, partners.id))
          .leftJoin(users, eq(partners.userId, users.id))
          .where(eq(productOwnershipLines.ownershipId, active.id));

        result.set(pid, {
          version: active.version,
          status: active.status,
          companyCutBps: active.companyCutBps,
          partners: lineRows.map((l) => ({
            partnerId: l.partnerId,
            displayName: l.userName ?? "Partner",
            shareBps: l.shareBps,
          })),
        });
      }
    }

    return result;
  }

  private async buildVersionView(
    own: typeof productOwnerships.$inferSelect,
    creator: typeof users.$inferSelect | null,
    dbClient: DbOrTx,
  ): Promise<OwnershipVersionView> {
    const lineRows = await dbClient
      .select({
        partnerId: productOwnershipLines.partnerId,
        shareBps: productOwnershipLines.shareBps,
        userName: users.name,
      })
      .from(productOwnershipLines)
      .leftJoin(partners, eq(productOwnershipLines.partnerId, partners.id))
      .leftJoin(users, eq(partners.userId, users.id))
      .where(eq(productOwnershipLines.ownershipId, own.id));

    return {
      id: own.id,
      productId: own.productId,
      version: own.version,
      status: own.status,
      companyCutBps: own.companyCutBps,
      lines: lineRows.map((l) => ({
        partnerId: l.partnerId,
        displayName: l.userName ?? "Partner",
        shareBps: l.shareBps,
      })),
      effectiveFrom: own.effectiveFrom ? own.effectiveFrom.toISOString() : null,
      approvalRequestId: own.approvalRequestId,
      createdBy: {
        id: creator?.id ?? own.createdBy ?? "",
        name: creator?.name ?? "Admin",
      },
      createdAt: own.createdAt.toISOString(),
    };
  }
}

export const ownershipService = new DefaultOwnershipService();

// Register ownership.change approval handlers with approvalsService
approvalsService.registerApplyHandler("ownership.change", async (_ctx, payload, tx) => {
  await ownershipService.applyOwnershipChange(payload as OwnershipChangePayload, tx);
});

approvalsService.registerRejectHandler("ownership.change", async (_ctx, payload, tx) => {
  await ownershipService.onOwnershipChangeRejected(payload as OwnershipChangePayload, tx);
});

/** Preserved for freeze and contract tests (PHASE-02 P2.8). */
export function createNotImplementedOwnershipService(): OwnershipService {
  return createNotImplemented<OwnershipService>("ownership", "P3", {
    proposeOwnership: "async",
    applyOwnershipChange: "async",
    onOwnershipChangeRejected: "async",
    createInitial: "async",
    activateForPublish: "async",
    getActiveAt: "async",
    listVersions: "async",
    summaryFor: "async",
  });
}
