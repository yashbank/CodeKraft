"use server";

/**
 * Admin ⌘K search. Reuses the existing permission-checked admin list queries (each call enforces
 * its own permission; a failed one simply contributes no results) and filters in memory.
 */
import type { SearchItem } from "@/components/admin/types";
import { customerItems, orderItems, productItems } from "./global-search-items";

export async function searchAdmin(query: string): Promise<SearchItem[]> {
  const q = String(query ?? "")
    .trim()
    .slice(0, 100);
  if (q.length < 2) return [];
  try {
    const [{ getAdminRequestContext }, orders, users, catalog] = await Promise.all([
      import("@/lib/authz/admin-request-context"),
      import("@/modules/orders/queries"),
      import("@/modules/users/queries"),
      import("@/modules/catalog/queries"),
    ]);
    const ctx = await getAdminRequestContext();
    const [p, o, c] = await Promise.all([
      catalog.listProductsAdminQuery({ limit: 100, filters: { search: q } }, ctx),
      orders.listOrdersAdminQuery({ limit: 100 }, ctx),
      users.listCustomersQuery({ limit: 100 }, ctx),
    ]);
    return [
      ...(p.ok ? productItems(p.data.items, q) : []),
      ...(o.ok ? orderItems(o.data.items, q) : []),
      ...(c.ok ? customerItems(c.data.items, q) : []),
    ];
  } catch {
    return [];
  }
}
