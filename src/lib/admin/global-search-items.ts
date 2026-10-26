import type { SearchItem } from "@/components/admin/types";

export const MAX_PER_GROUP = 5;

const norm = (s: string) => s.trim().toLowerCase();

/** Case-insensitive "all words appear in some field" match. */
export function matchesQuery(q: string, ...fields: Array<string | null | undefined>): boolean {
  const words = norm(q).split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  const hay = fields.map((f) => norm(f ?? "")).join(" ");
  return words.every((w) => hay.includes(w));
}

export function productItems(
  rows: Array<{ id: string; name: string; status: string }>,
  q: string,
): SearchItem[] {
  return rows
    .filter((p) => matchesQuery(q, p.name))
    .slice(0, MAX_PER_GROUP)
    .map((p) => ({
      group: "Products",
      label: p.name,
      hint: p.status,
      href: `/admin/products/${p.id}`,
    }));
}

export function orderItems(
  rows: Array<{ orderId: string; orderNo: string; customer: { name: string; email: string } }>,
  q: string,
): SearchItem[] {
  return rows
    .filter((o) => matchesQuery(q, o.orderNo, o.customer.name, o.customer.email))
    .slice(0, MAX_PER_GROUP)
    .map((o) => ({
      group: "Orders",
      label: o.orderNo,
      hint: o.customer.email,
      href: `/admin/orders/${o.orderId}`,
    }));
}

export function customerItems(
  rows: Array<{ user: { id: string; name: string; email: string } }>,
  q: string,
): SearchItem[] {
  return rows
    .filter((c) => matchesQuery(q, c.user.name, c.user.email))
    .slice(0, MAX_PER_GROUP)
    .map((c) => ({
      group: "Customers",
      label: c.user.name || c.user.email,
      hint: c.user.email,
      href: `/admin/customers/${c.user.id}`,
    }));
}
