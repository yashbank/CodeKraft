/**
 * Finance ledger queries (docs/06 API-FIN-01, API-FIN-02, BR-17).
 *
 * Implements `listLedgerEntries` and `getOrderAllocation` with permission and data-scoping checks.
 */
import { and, desc, asc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { AppError, ErrorCode } from "@/lib/errors";
import { assertPermission, can } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { type Currency, money } from "@/lib/money";
import { productOwnerships } from "../../../drizzle/schema/ownership";
import { orderItems, orders } from "../../../drizzle/schema/commerce";
import {
  type EntryType,
  allocations,
  ledgerEntries,
} from "../../../drizzle/schema/finance";
import { partners } from "../../../drizzle/schema/users-ext";
import { products } from "../../../drizzle/schema/catalog";
import type {
  GetOrderAllocationInput,
  ItemAllocationView,
  LedgerEntryView,
  LedgerListResult,
  ListLedgerEntriesInput,
  OrderAllocationView,
} from "./types";

async function getDatabase(tx?: DbOrTx): Promise<DbOrTx> {
  if (tx) return tx;
  const { db } = await import("@/lib/db");
  return db;
}

export async function getOrderAllocation(
  ctx: RequestContext,
  input: GetOrderAllocationInput,
  tx?: DbOrTx,
): Promise<OrderAllocationView> {
  assertPermission(ctx, "finance.ledger.read");
  const db = await getDatabase(tx);

  // 1. Load order
  const [order] = await db
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      currency: orders.currency,
      createdBy: orders.createdBy,
    })
    .from(orders)
    .where(eq(orders.id, input.orderId))
    .limit(1);

  if (!order) {
    throw new AppError(ErrorCode.NOT_FOUND, "Order not found");
  }

  // 2. Load order items and allocations
  const items = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      description: orderItems.description,
      unitMinor: orderItems.unitMinor,
      quantity: orderItems.quantity,
      discountMinor: orderItems.discountMinor,
      taxMinor: orderItems.taxMinor,
      totalMinor: orderItems.totalMinor,
      ownershipId: orderItems.ownershipId,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, input.orderId))
    .orderBy(orderItems.createdAt);

  const itemAllocations =
    items.length > 0
      ? await db
          .select()
          .from(allocations)
          .where(inArray(allocations.orderItemId, items.map((i) => i.id)))
      : [];

  const allocationByItemId = new Map(itemAllocations.map((a) => [a.orderItemId, a]));

  // 3. Load ledger entries for deductions (bank charges, gateway fees)
  const entries = await db
    .select({
      orderItemId: ledgerEntries.orderItemId,
      entryType: ledgerEntries.entryType,
      amountMinor: ledgerEntries.amountMinor,
    })
    .from(ledgerEntries)
    .where(
      and(
        eq(ledgerEntries.orderId, input.orderId),
        inArray(ledgerEntries.entryType, ["gateway_fee", "bank_charge"]),
      ),
    );

  const deductionsByItemId = new Map<string, { gatewayFee: number; bankCharge: number }>();
  for (const item of items) {
    deductionsByItemId.set(item.id, { gatewayFee: 0, bankCharge: 0 });
  }
  for (const entry of entries) {
    if (entry.orderItemId) {
      const d = deductionsByItemId.get(entry.orderItemId) ?? { gatewayFee: 0, bankCharge: 0 };
      if (entry.entryType === "gateway_fee") d.gatewayFee += entry.amountMinor;
      if (entry.entryType === "bank_charge") d.bankCharge += entry.amountMinor;
      deductionsByItemId.set(entry.orderItemId, d);
    }
  }

  // 4. Load ownership versions if applicable
  const ownershipIds = items
    .map((i) => i.ownershipId)
    .filter((id): id is string => typeof id === "string");

  const ownerships =
    ownershipIds.length > 0
      ? await db
          .select({ id: productOwnerships.id, version: productOwnerships.version })
          .from(productOwnerships)
          .where(inArray(productOwnerships.id, ownershipIds))
      : [];
  const versionById = new Map(ownerships.map((o) => [o.id, o.version]));

  // 5. Scoping check: admin without read_all sees own partner lines + own-product entries
  const hasReadAll = can(ctx, "finance.ledger.read_all");
  let myPartnerId: string | null = ctx.partnerId ?? null;
  const ownedProductIds = new Set<string>();

  if (!hasReadAll) {
    if (!myPartnerId) {
      const [partner] = await db
        .select({ id: partners.id })
        .from(partners)
        .where(eq(partners.userId, ctx.userId))
        .limit(1);

      if (partner) {
        myPartnerId = partner.id;
      }
    }

    const myProducts = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.createdBy, ctx.userId));

    for (const p of myProducts) ownedProductIds.add(p.id);

    // If caller has neither partner nor product ownership on this order, forbidden
    const hasOrderAccess = items.some(
      (item) =>
        (item.productId && ownedProductIds.has(item.productId)) ||
        (allocationByItemId.get(item.id)?.lines.some((l) => l.partner_id === myPartnerId)),
    );

    if (!hasOrderAccess) {
      throw new AppError(ErrorCode.FORBIDDEN, "Forbidden: insufficient access to order allocations");
    }
  }

  // 6. Build item allocation views
  const itemViews: ItemAllocationView[] = items.map((item) => {
    const alloc = allocationByItemId.get(item.id);
    const d = deductionsByItemId.get(item.id) ?? { gatewayFee: 0, bankCharge: 0 };
    const curr = order.currency as Currency;
    const grossMinor = item.unitMinor * item.quantity;

    let lines = alloc?.lines ?? [];
    if (!hasReadAll) {
      // Filter out lines of other partners
      lines = lines.filter((l) => l.partner_id === myPartnerId);
    }

    return {
      orderItemId: item.id,
      description: item.description,
      gross: money(grossMinor, curr),
      discount: money(item.discountMinor, curr),
      tax: money(item.taxMinor, curr),
      gatewayFee: money(d.gatewayFee, curr),
      bankCharge: money(d.bankCharge, curr),
      distributable: money(alloc?.distributableMinor ?? 0, curr),
      companyCut: money(alloc?.companyMinor ?? 0, curr),
      companyCutBps: alloc?.companyCutBps ?? 0,
      lines: lines.map((l) => ({
        partnerId: l.partner_id,
        shareBps: l.share_bps,
        amount: money(l.amount_minor, curr),
      })),
      ownershipId: item.ownershipId,
      ownershipVersion: item.ownershipId ? (versionById.get(item.ownershipId) ?? null) : null,
    };
  });

  return {
    orderId: order.id,
    orderNo: order.orderNo,
    currency: order.currency as Currency,
    items: itemViews,
  };
}

export async function listLedgerEntries(
  ctx: RequestContext,
  input: ListLedgerEntriesInput,
  tx?: DbOrTx,
): Promise<LedgerListResult> {
  assertPermission(ctx, "finance.ledger.read");
  const db = await getDatabase(tx);

  const hasReadAll = can(ctx, "finance.ledger.read_all");
  let myPartnerId: string | null = ctx.partnerId ?? null;
  const ownedProductIds = new Set<string>();

  if (!hasReadAll) {
    if (!myPartnerId) {
      const [partner] = await db
        .select({ id: partners.id })
        .from(partners)
        .where(eq(partners.userId, ctx.userId))
        .limit(1);

      if (partner) {
        myPartnerId = partner.id;
      }
    }

    // If caller specified a partnerId filter that doesn't match their own partnerId: FORBIDDEN
    if (input.filters?.partnerId && input.filters.partnerId !== myPartnerId) {
      throw new AppError(ErrorCode.FORBIDDEN, "Cannot read another partner's ledger lines");
    }

    const myProducts = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.createdBy, ctx.userId));
    for (const p of myProducts) ownedProductIds.add(p.id);
  }

  // Base query with filters
  const conditions = [];

  if (input.filters?.entryType && input.filters.entryType.length > 0) {
    conditions.push(inArray(ledgerEntries.entryType, input.filters.entryType));
  }
  if (input.filters?.currency) {
    conditions.push(eq(ledgerEntries.currency, input.filters.currency));
  }
  if (input.filters?.approvalRequestId) {
    conditions.push(eq(ledgerEntries.approvalRequestId, input.filters.approvalRequestId));
  }
  if (input.filters?.dateFrom) {
    conditions.push(gte(ledgerEntries.createdAt, new Date(input.filters.dateFrom)));
  }
  if (input.filters?.dateTo) {
    conditions.push(lte(ledgerEntries.createdAt, new Date(input.filters.dateTo)));
  }

  // Scoping condition for non-read_all
  if (!hasReadAll) {
    const scopeConditions = [];
    if (myPartnerId) {
      scopeConditions.push(
        and(eq(ledgerEntries.partyType, "partner"), eq(ledgerEntries.partnerId, myPartnerId)),
      );
    }
    if (ownedProductIds.size > 0) {
      const itemRows = await db
        .select({ id: orderItems.id })
        .from(orderItems)
        .where(inArray(orderItems.productId, Array.from(ownedProductIds)));
      const itemIds = itemRows.map((r) => r.id);
      if (itemIds.length > 0) {
        scopeConditions.push(inArray(ledgerEntries.orderItemId, itemIds));
      }
    }

    if (scopeConditions.length === 0) {
      return {
        items: [],
        nextCursor: null,
        total: 0,
        totals: { byType: {} },
      };
    }
    conditions.push(or(...scopeConditions));
  } else if (input.filters?.partnerId) {
    conditions.push(eq(ledgerEntries.partnerId, input.filters.partnerId));
  }

  if (input.filters?.orderNo) {
    const [matchingOrder] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.orderNo, input.filters.orderNo))
      .limit(1);
    if (!matchingOrder) {
      return { items: [], nextCursor: null, total: 0, totals: { byType: {} } };
    }
    conditions.push(eq(ledgerEntries.orderId, matchingOrder.id));
  }

  if (input.filters?.productId) {
    const itemRows = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .where(eq(orderItems.productId, input.filters.productId));
    const itemIds = itemRows.map((r) => r.id);
    if (itemIds.length === 0) {
      return { items: [], nextCursor: null, total: 0, totals: { byType: {} } };
    }
    conditions.push(inArray(ledgerEntries.orderItemId, itemIds));
  }

  // Cursor pagination by seq
  const pageSize = input.limit ?? 50;
  const isAsc = input.sort === "seq:asc";

  if (input.cursor) {
    const cursorSeq = Number(input.cursor);
    if (!Number.isNaN(cursorSeq)) {
      if (isAsc) {
        conditions.push(sql`${ledgerEntries.seq} > ${cursorSeq}`);
      } else {
        conditions.push(sql`${ledgerEntries.seq} < ${cursorSeq}`);
      }
    }
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const sortDirection = isAsc ? asc(ledgerEntries.seq) : desc(ledgerEntries.seq);

  const rows = await db
    .select({
      id: ledgerEntries.id,
      seq: ledgerEntries.seq,
      entryType: ledgerEntries.entryType,
      partyType: ledgerEntries.partyType,
      partnerId: ledgerEntries.partnerId,
      amountMinor: ledgerEntries.amountMinor,
      currency: ledgerEntries.currency,
      fxRateToInr: ledgerEntries.fxRateToInr,
      amountInrMinor: ledgerEntries.amountInrMinor,
      memo: ledgerEntries.memo,
      createdAt: ledgerEntries.createdAt,
      createdBy: ledgerEntries.createdBy,
      orderId: ledgerEntries.orderId,
      orderItemId: ledgerEntries.orderItemId,
      paymentId: ledgerEntries.paymentId,
      refundId: ledgerEntries.refundId,
      payoutId: ledgerEntries.payoutId,
      expenseId: ledgerEntries.expenseId,
      approvalRequestId: ledgerEntries.approvalRequestId,
    })
    .from(ledgerEntries)
    .where(whereClause)
    .orderBy(sortDirection)
    .limit(pageSize + 1);

  const hasNextPage = rows.length > pageSize;
  const pageRows = hasNextPage ? rows.slice(0, pageSize) : rows;
  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor = hasNextPage && lastRow ? String(lastRow.seq) : null;

  // Order numbers mapping
  const orderIds = Array.from(
    new Set(pageRows.map((r) => r.orderId).filter((id): id is string => typeof id === "string")),
  );
  const orderMap = new Map<string, string>();
  if (orderIds.length > 0) {
    const orderRows = await db
      .select({ id: orders.id, orderNo: orders.orderNo })
      .from(orders)
      .where(inArray(orders.id, orderIds));
    for (const o of orderRows) orderMap.set(o.id, o.orderNo);
  }

  // Calculate totals by type across page
  const byType: Partial<Record<EntryType, { amountMinor: number; currency: Currency }>> = {};
  for (const r of pageRows) {
    const curr = (r.currency as Currency) ?? "INR";
    const existing = byType[r.entryType];
    if (existing) {
      existing.amountMinor += r.amountMinor;
    } else {
      byType[r.entryType] = { amountMinor: r.amountMinor, currency: curr };
    }
  }

  const items: LedgerEntryView[] = pageRows.map((r) => ({
    entryId: r.id,
    seq: r.seq,
    entryType: r.entryType,
    partyType: r.partyType,
    partnerId: r.partnerId,
    amount: money(r.amountMinor, r.currency as Currency),
    amountInrMinor: r.amountInrMinor,
    fxRateToInr: r.fxRateToInr,
    memo: r.memo,
    createdAt: r.createdAt.toISOString(),
    createdBy: r.createdBy,
    links: {
      orderId: r.orderId,
      orderNo: r.orderId ? (orderMap.get(r.orderId) ?? null) : null,
      orderItemId: r.orderItemId,
      paymentId: r.paymentId,
      refundId: r.refundId,
      payoutId: r.payoutId,
      expenseId: r.expenseId,
      approvalRequestId: r.approvalRequestId,
    },
  }));

  return {
    items,
    nextCursor,
    total: items.length,
    totals: { byType },
  };
}
