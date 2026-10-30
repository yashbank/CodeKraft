/**
 * Light poll behind the admin "New order" toast (P14-12a). Same gate as the admin orders list
 * (`orders.read`); returns only order numbers and ids, never customer data.
 */
import { desc, gt, sql } from "drizzle-orm";
import { assertPermission } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import type { NewOrderAlerts } from "./alerts-text";
import { orders } from "../../../drizzle/schema/commerce";

export async function newOrdersSince(ctx: RequestContext, since: Date): Promise<NewOrderAlerts> {
  assertPermission(ctx, "orders.read");
  const { db } = await import("@/lib/db");
  const where = gt(orders.createdAt, since);
  const [[c], latest] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(where),
    db
      .select({ id: orders.id, orderNo: orders.orderNo })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(3),
  ]);
  return { serverTime: new Date().toISOString(), count: c?.n ?? 0, latest };
}
