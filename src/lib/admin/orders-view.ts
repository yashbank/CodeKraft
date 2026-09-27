/**
 * View-model mappers: orders/payments/finance/audit domain shapes -> admin component prop shapes
 * (`components/admin/types`). Kept out of the page components per the phase convention (mapping
 * never lives in a component) and out of the components themselves (they stay props-driven).
 *
 * Known gaps vs. a fully-populated screen -- see the phase report for the full list:
 *  - `OrderItemDetail.ownershipVersion` is never set: `getOrderAdmin` has no ownership-version
 *    lookup wired (only the item's own `unit`/`discount`/`tax`/`total` come from `order_items`).
 *  - `OrderItemDetail.entitlement` is always undefined: `getOrderAdmin` always returns
 *    `entitlements: []` (entitlements/delivery is a separate module, out of this phase's scope).
 *  - Partner names (allocation lines, ledger "partner" rows, project-order split lines) fall back
 *    to a short id (`Partner 3f2a1c9e`) when the caller's `finance.ledger.read_all` /
 *    `users.admin.manage` permission is missing and `listPartners` couldn't be read.
 *  - `linkedQueries` is always empty: `queries.listQueriesAdmin` has no `orderId` filter yet.
 *  - Timeline "actor" is the audited role (`admin`, `super_admin`, `customer`, or a system actor
 *    name like `cron:orders.expire`), not a resolved display name -- no batch user-name query is
 *    wired for this.
 */
import type { Currency } from "@/lib/money";
import type { StatusValue } from "@/lib/status-tone";
import type { AuditLogRow } from "@/modules/audit/types";
import type { LedgerEntryView, OrderAllocationView } from "@/modules/finance/types";
import type { OrderAdminRow, OrderDetail, OrderPaymentView } from "@/modules/orders/types";
import type { PaymentInstructions } from "@/modules/payments/provider";
import type {
  LedgerEntry,
  MoneyLike,
  OrderDetailData,
  OrderItemDetail,
  OrderRow,
  TimelineEvent,
} from "@/components/admin/types";

const AWAITING_AGE_MS = 24 * 60 * 60 * 1000;

function shortId(id: string | null): string {
  return id ? id.slice(0, 8) : "unknown";
}

function partnerLabel(partnerId: string | null, partnerNames: ReadonlyMap<string, string>): string {
  if (!partnerId) return "Unknown partner";
  return partnerNames.get(partnerId) ?? `Partner ${shortId(partnerId)}`;
}

function formatInstructions(instructions: PaymentInstructions | null): string {
  if (!instructions) return "Not generated yet";
  if (instructions.method === "manual_upi") {
    return `UPI · ${instructions.vpa}`;
  }
  if (instructions.method === "manual_bank") {
    return `Bank · ${instructions.bankName} ${instructions.accountNo} (IFSC ${instructions.ifsc})`;
  }
  return `${instructions.method} · ${instructions.kind}`;
}

function isAwaiting(paymentStatus: string | null, paymentCreatedAt: string | null, now: Date): boolean {
  if (paymentStatus === "submitted") return true;
  if (paymentStatus !== "initiated" || !paymentCreatedAt) return false;
  return now.getTime() - new Date(paymentCreatedAt).getTime() >= AWAITING_AGE_MS;
}

export function mapOrderAdminRowToOrderRow(row: OrderAdminRow, now: string): OrderRow {
  return {
    id: row.orderId,
    number: row.orderNo,
    placedAt: row.createdAt,
    customer: { name: row.customer.name, email: row.customer.email, id: row.customer.userId ?? "" },
    type: row.type,
    items: row.itemDescriptions,
    total: row.total,
    payment: {
      provider: (row.paymentProvider ?? "manual_upi") as StatusValue<"payments.provider">,
      status: (row.paymentStatus ?? "initiated") as StatusValue<"payments.status">,
      reference: row.paymentReference ?? undefined,
      paymentId: row.paymentId ?? undefined,
    },
    status: row.status,
    expiresAt: row.expiresAt ?? undefined,
    invoiceNumber: row.invoiceNumber ?? undefined,
    awaitingConfirmation: isAwaiting(row.paymentStatus, row.paymentCreatedAt, new Date(now)),
  };
}

function mapLedgerEntry(e: LedgerEntryView, partnerNames: ReadonlyMap<string, string>): LedgerEntry {
  const party =
    e.partyType === "partner"
      ? partnerLabel(e.partnerId, partnerNames)
      : e.partyType === "company"
        ? "Company"
        : e.partyType === "tax_authority"
          ? "Tax authority"
          : e.partyType === "gateway"
            ? "Gateway"
            : e.partyType === "bank"
              ? "Bank"
              : "Customer";
  return {
    seq: e.seq,
    at: e.createdAt,
    type: e.entryType,
    party,
    partyType: e.partyType,
    order: e.links.orderNo ?? undefined,
    amount: e.amount,
    fxRate: e.fxRateToInr,
    amountInr: e.amountInrMinor,
    memo: e.memo ?? "",
    ref: e.links.paymentId ?? e.links.refundId ?? e.links.payoutId ?? undefined,
    createdBy: e.createdBy,
  };
}

const ADMIN_ROLES = new Set(["admin", "super_admin", "staff"]);

function mapAuditRowToTimelineEvent(row: AuditLogRow): TimelineEvent {
  const role = row.actorRole ?? "system";
  const kind: TimelineEvent["kind"] = row.actorId
    ? ADMIN_ROLES.has(role)
      ? "admin"
      : "customer"
    : "system";
  return {
    at: row.createdAt,
    actor: role,
    text: row.action,
    kind,
  };
}

export interface OrderDetailExtras {
  ledger: LedgerEntryView[];
  allocation: OrderAllocationView | null;
  timelineRows: AuditLogRow[];
  now: string;
  /** `partners.id -> displayName`, best-effort (empty when the caller can't list partners). */
  partnerNames: ReadonlyMap<string, string>;
}

export function mapOrderDetailToOrderDetailData(
  detail: OrderDetail,
  extras: OrderDetailExtras,
): OrderDetailData {
  const { order, items, itemMeta, payments, refunds, splitApproval, coupon, quote, customerExtra } =
    detail;
  const currency = order.currency as Currency;
  const latestPayment: OrderPaymentView | undefined = payments[0];
  const previousFailed = payments
    .filter((p) => p.paymentId !== latestPayment?.paymentId && p.status === "failed")
    .map((p) => ({ at: p.createdAt, reason: p.failureReason ?? "Payment failed" }));

  const orderRow: OrderRow = {
    id: order.id,
    number: order.orderNo,
    placedAt: order.createdAt.toISOString(),
    customer: {
      name: order.billingSnapshot?.name ?? "Customer",
      email: order.billingSnapshot?.email ?? "",
      id: order.userId ?? "",
    },
    type: order.type,
    items: items.map((i) => i.description),
    total: { amountMinor: order.totalMinor, currency },
    payment: {
      provider: (latestPayment?.method ?? "manual_upi") as StatusValue<"payments.provider">,
      status: (latestPayment?.status ?? "initiated") as StatusValue<"payments.status">,
      reference: latestPayment?.customerReference ?? undefined,
      paymentId: latestPayment?.paymentId,
    },
    status: order.status,
    expiresAt: order.expiresAt ? order.expiresAt.toISOString() : undefined,
    invoiceNumber: detail.invoice?.invoiceNo,
    awaitingConfirmation: isAwaiting(
      latestPayment?.status ?? null,
      latestPayment?.createdAt ?? null,
      new Date(extras.now),
    ),
  };

  const itemDetails: OrderItemDetail[] = items.map((it) => {
    const meta = itemMeta[it.id];
    return {
      id: it.id,
      product: meta?.productName ?? it.description,
      offering: it.description,
      qty: it.quantity,
      unit: { amountMinor: it.unitMinor, currency },
      discount: { amountMinor: it.discountMinor, currency },
      tax: { amountMinor: it.taxMinor, currency },
      total: { amountMinor: it.totalMinor, currency },
      // No ownership-version lookup wired in `getOrderAdmin` -- see file header.
      ownershipVersion: undefined,
      deliveryType: (meta?.deliveryType ?? "custom") as StatusValue<"entitlements.delivery_type">,
      // `getOrderAdmin` always returns `entitlements: []` -- entitlements/delivery is a separate
      // module, out of this phase's scope.
      entitlement: undefined,
      splitSnapshot: it.splitSnapshot
        ? {
            companyCutBps: it.splitSnapshot.company_cut_bps,
            lines: it.splitSnapshot.lines.map((l) => ({
              partnerId: l.partner_id,
              partnerName: partnerLabel(l.partner_id, extras.partnerNames),
              bps: l.share_bps,
            })),
          }
        : undefined,
    };
  });

  const allocation: OrderDetailData["allocation"] = extras.allocation
    ? {
        companyCut: extras.allocation.items.reduce<MoneyLike>(
          (acc, i) => ({ amountMinor: acc.amountMinor + i.companyCut.amountMinor, currency: acc.currency }),
          { amountMinor: 0, currency: extras.allocation.currency },
        ),
        lines: Object.values(
          extras.allocation.items.reduce<Record<string, { partner: string; amount: MoneyLike; bps: number }>>(
            (acc, item) => {
              for (const line of item.lines) {
                const key = line.partnerId;
                const existing = acc[key];
                if (existing) {
                  existing.amount = {
                    amountMinor: existing.amount.amountMinor + line.amount.amountMinor,
                    currency: existing.amount.currency,
                  };
                } else {
                  acc[key] = { partner: partnerLabel(line.partnerId, extras.partnerNames), amount: line.amount, bps: line.shareBps };
                }
              }
              return acc;
            },
            {},
          ),
        ),
      }
    : undefined;

  return {
    order: orderRow,
    splitApproval: splitApproval
      ? { status: splitApproval.status, approver: "Pending decision", approvalId: splitApproval.approvalRequestId }
      : undefined,
    payment: {
      provider: (latestPayment?.method ?? "manual_upi") as StatusValue<"payments.provider">,
      status: (latestPayment?.status ?? "initiated") as StatusValue<"payments.status">,
      due: latestPayment?.amountDue ?? { amountMinor: order.totalMinor, currency },
      customerReference: latestPayment?.customerReference ?? undefined,
      submittedAt: latestPayment?.customerSubmittedAt ?? undefined,
      instructionsSnapshot: formatInstructions(latestPayment?.instructions ?? null),
      received: latestPayment?.amountReceived ?? undefined,
      shortfall: latestPayment?.bankShortfall ?? undefined,
      customerCredit: latestPayment?.customerCredit ?? undefined,
      confirmedBy: latestPayment?.confirmedByName ?? undefined,
      confirmedAt: latestPayment?.confirmedAt ?? undefined,
      previousFailed,
      paymentId: latestPayment?.paymentId,
    },
    items: itemDetails,
    ledger: extras.ledger.map((e) => mapLedgerEntry(e, extras.partnerNames)),
    allocation,
    timeline: extras.timelineRows
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map(mapAuditRowToTimelineEvent),
    customer: {
      id: order.userId ?? "",
      name: order.billingSnapshot?.name ?? "Customer",
      email: order.billingSnapshot?.email ?? "",
      country: order.billingSnapshot?.country ?? "",
      company: order.billingSnapshot?.company ?? undefined,
      gstin: order.billingSnapshot?.gst_number ?? undefined,
      tags: customerExtra.tags,
      notes: customerExtra.notes ?? undefined,
    },
    billing: {
      name: order.billingSnapshot?.name ?? "",
      address: order.billingSnapshot?.address ?? "",
      country: order.billingSnapshot?.country ?? "",
    },
    coupon: coupon ? { code: coupon.code, discount: { amountMinor: coupon.discountMinor, currency } } : undefined,
    quote: quote ? { id: quote.id, title: quote.title } : undefined,
    refunds: refunds.map((r) => ({
      id: r.refundId,
      amount: { amountMinor: r.amountMinor, currency: r.currency },
      status: r.status,
      creditNote: r.creditNoteNo ?? undefined,
      at: r.createdAt,
      reason: r.reason,
    })),
    refundable: order.status === "paid" || order.status === "fulfilled" || order.status === "partially_refunded",
    linkedQueries: [],
  };
}
