/**
 * Plain-language text for the admin Approvals card: what is being approved, the requester's
 * reason and the readable detail rows. Pure (no DB); callers pass resolved names as `facts`.
 * Never emits UUIDs, enum codes or JSON.
 */
import { format as formatMoney, type Currency } from "@/lib/money";
import type { ApprovalType } from "@/modules/approvals/types";

export interface ApprovalFacts {
  productName?: string;
  orderNo?: string;
  partnerName?: string;
  userEmail?: string;
  /** Refund amount, looked up from the refund row (the payload only carries its id). */
  refundMinor?: number;
  currency?: Currency;
}

type Payload = Record<string, unknown>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined);
const words = (s: string) => s.replace(/_/g, " ");

function money(minor: unknown, currency: unknown): string | undefined {
  return typeof minor === "number" && typeof currency === "string"
    ? formatMoney({ amountMinor: minor, currency: currency as Currency })
    : undefined;
}

/** One line, e.g. "Refund ₹4,000 on order CK-ORD-000012". */
export function describeApproval(type: ApprovalType, p: Payload, f: ApprovalFacts = {}): string {
  const product = f.productName ? `"${f.productName}"` : "a product";
  switch (type) {
    case "product.publish":
      return `Publish product ${product}`;
    case "ownership.change":
      return `Change the ownership split of ${product}`;
    case "product.archive":
      return `Archive product ${product}`;
    case "product.delete":
      return `Delete product ${product}`;
    case "refund.issue": {
      const amt = f.refundMinor !== undefined ? money(f.refundMinor, f.currency) : undefined;
      return `Refund${amt ? ` ${amt}` : ""} on ${f.orderNo ? `order ${f.orderNo}` : "an order"}`;
    }
    case "project_order.split":
      return `Approve the revenue split for ${f.orderNo ? `project order ${f.orderNo}` : "a project order"}`;
    case "payout.record": {
      const amt = money(p.amountMinor, p.currency);
      return `Payout${amt ? ` of ${amt}` : ""} to ${f.partnerName ?? "a partner"}`;
    }
    case "ledger.adjustment": {
      const n = Array.isArray(p.lines) ? p.lines.length : 0;
      return `Ledger adjustment${n ? ` (${n} line${n === 1 ? "" : "s"})` : ""}`;
    }
    case "admin.user_change": {
      const who = f.userEmail ?? str(p.email) ?? "an admin user";
      const role = str(p.role) ? words(String(p.role)) : "";
      if (p.kind === "invite") return `Invite ${who} as ${role || "admin"}`;
      if (p.kind === "change_role") return `Change the role of ${who} to ${role || "a new role"}`;
      return `Remove admin access for ${who}`;
    }
  }
}

/** The requesting admin's own words, when the payload carries any. */
export function approvalReason(p: Payload): string | undefined {
  return str(p.reason) ?? str(p.note);
}

/** "Field / value" rows for the detail table; IDs, nested data and the reason are left out. */
export function approvalDetailRows(p: Payload): { label: string; after: string }[] {
  const rows: { label: string; after: string }[] = [];
  const amount = money(p.amountMinor, p.currency);
  if (amount) rows.push({ label: "Amount", after: amount });
  for (const [key, v] of Object.entries(p)) {
    if (["amountMinor", "currency", "reason", "note", "kind", "lines"].includes(key)) continue;
    if (typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") continue;
    if (typeof v === "string" && (UUID_RE.test(v) || v.trim() === "")) continue;
    const label = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ");
    rows.push({
      label: label.charAt(0).toUpperCase() + label.slice(1).toLowerCase(),
      after: typeof v === "string" ? words(v) : String(v),
    });
  }
  return rows;
}
