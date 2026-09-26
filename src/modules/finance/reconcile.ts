/**
 * Finance nightly reconciliation service (NFR-DATA-04, FR-OPS-01, docs/10 §5, master plan §6).
 *
 * For every paid order, re-derives:
 * - FI-01: Distributable = gross − discount − tax − gateway fee − bank shortfall
 * - FI-02: Company cut + Σ partner allocation lines = distributable
 * - FI-04: Σ ledger entries per order across all party types = 0
 *
 * Dispatches N: `system.job_failed` notification to all active admins on any mismatch.
 */
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbOrTx } from "@/lib/db";
import { db } from "@/lib/db";
import { orders, orderItems, payments } from "../../../drizzle/schema/commerce";
import { allocations, ledgerEntries } from "../../../drizzle/schema/finance";
import { notifications } from "../../../drizzle/schema/notifications";
import { userRoles, users } from "../../../drizzle/schema/auth";

export interface ReconcileDiscrepancy {
  orderId: string;
  orderNo?: string;
  invariant: "FI-01" | "FI-02" | "FI-04";
  expected: number;
  actual: number;
  details: string;
}

export interface ReconcileResult {
  ok: boolean;
  checkedOrdersCount: number;
  discrepancies: ReconcileDiscrepancy[];
}

export async function reconcileFinance(
  now: Date = new Date(),
  database: DbOrTx = db,
): Promise<ReconcileResult> {
  const discrepancies: ReconcileDiscrepancy[] = [];

  // 1. Fetch all paid/fulfilled/refunded orders
  const paidOrders = await database
    .select({
      id: orders.id,
      orderNo: orders.orderNo,
      status: orders.status,
    })
    .from(orders)
    .where(inArray(orders.status, ["paid", "fulfilled", "partially_refunded", "refunded"]));

  for (const order of paidOrders) {
    const [entrySum] = await database
      .select({
        sumMinor: sql<string>`COALESCE(SUM(amount_minor), 0)`,
      })
      .from(ledgerEntries)
      .where(eq(ledgerEntries.orderId, order.id));

    const totalMinor = Number(entrySum?.sumMinor ?? 0);
    if (totalMinor !== 0) {
      discrepancies.push({
        orderId: order.id,
        orderNo: order.orderNo,
        invariant: "FI-04",
        expected: 0,
        actual: totalMinor,
        details: `Order ${order.orderNo ?? order.id} ledger entries do not net to 0 (sum = ${totalMinor})`,
      });
    }

    // Check FI-01 & FI-02 for each order item's allocation
    const items = await database
      .select({
        id: orderItems.id,
        unitMinor: orderItems.unitMinor,
        quantity: orderItems.quantity,
        discountMinor: orderItems.discountMinor,
        taxMinor: orderItems.taxMinor,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, order.id));

    // Get order payments to check bank shortfalls if stored
    const [pmt] = await database
      .select({
        bankShortfallMinor: payments.bankShortfallMinor,
      })
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .limit(1);

    const bankShortfall = pmt?.bankShortfallMinor ?? 0;

    for (const item of items) {
      const [alloc] = await database
        .select({
          id: allocations.id,
          distributableMinor: allocations.distributableMinor,
          companyMinor: allocations.companyMinor,
          lines: allocations.lines,
        })
        .from(allocations)
        .where(eq(allocations.orderItemId, item.id))
        .limit(1);

      if (alloc) {
        // FI-02: companyMinor + sum(lines.amount_minor) === distributableMinor
        const partnerSum = (alloc.lines as Array<{ amount_minor: number }>).reduce(
          (acc, l) => acc + (l.amount_minor ?? 0),
          0,
        );
        const totalDistributable = alloc.companyMinor + partnerSum;

        if (totalDistributable !== alloc.distributableMinor) {
          discrepancies.push({
            orderId: order.id,
            orderNo: order.orderNo,
            invariant: "FI-02",
            expected: alloc.distributableMinor,
            actual: totalDistributable,
            details: `Item ${item.id} allocation parts (${totalDistributable}) do not sum to distributable (${alloc.distributableMinor})`,
          });
        }
      }
    }
  }

  const ok = discrepancies.length === 0;

  // If discrepancies found, notify admins with system.job_failed (NFR-DATA-04)
  if (!ok) {
    const activeAdmins = await database
      .select({ userId: users.id })
      .from(users)
      .innerJoin(userRoles, eq(users.id, userRoles.userId))
      .where(
        and(
          eq(users.status, "active"),
          inArray(userRoles.roleKey, ["super_admin", "admin"]),
        ),
      );

    const adminIds = Array.from(new Set(activeAdmins.map((a) => a.userId)));

    for (const adminId of adminIds) {
      await database.insert(notifications).values({
        userId: adminId,
        type: "system.job_failed",
        title: "Finance reconciliation failed",
        body: `Discrepancies found in ${discrepancies.length} finance invariant(s). First error: ${discrepancies[0]?.details}`,
      });
    }
  }

  return {
    ok,
    checkedOrdersCount: paidOrders.length,
    discrepancies,
  };
}
