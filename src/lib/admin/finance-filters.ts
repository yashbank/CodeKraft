/**
 * Finance sub-tab filters. The URL is the single source of truth: the toolbars write search
 * params, the server pages call the `parse*` helpers below to build the query filter object, and
 * `filter*` narrow the already-fetched, already-mapped rows (for fields the module queries cannot
 * express). Pure, so it is unit-tested without a DB.
 */
import { currencySchema } from "@/modules/_shared/zod";
import { ENTRY_TYPES, PARTY_TYPES } from "@/modules/finance/types";
import type { ListLedgerEntriesInput, ReportResult } from "@/modules/finance/types";
import type { AdjustmentRow, AllocationRow, ExpenseRow, PayoutRow } from "@/components/admin/types";

export type SearchParams = Record<string, string | string[] | undefined>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_NO_RE = /^CK-ORD-\d{6,}$/;

function one(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() ? s.trim() : undefined;
}
const date = (sp: SearchParams, k: string) => {
  const v = one(sp, k);
  // Rejects malformed dates; Date.parse also rejects out-of-range ones such as 2026-13-40.
  return v && DATE_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : undefined;
};
const uuid = (sp: SearchParams, k: string) => {
  const v = one(sp, k);
  return v && UUID_RE.test(v) ? v : undefined;
};

/** Both bounds are inclusive whole (UTC) days, matching the report queries. A reversed range is swapped. */
function range(sp: SearchParams): { from?: string; to?: string } {
  const from = date(sp, "from");
  const to = date(sp, "to");
  return from && to && to < from ? { from: to, to: from } : { from, to };
}

export function inDateRange(iso: string, from?: string, to?: string): boolean {
  const d = iso.slice(0, 10);
  return (!from || d >= from) && (!to || d <= to);
}

const includes = (hay: string | undefined, q: string | undefined) =>
  !q || (hay ?? "").toLowerCase().includes(q.toLowerCase());

// ---- Ledger (server-side: every field is a SQL WHERE in `listLedgerEntries`) -------------------

export function parseLedgerFilters(
  sp: SearchParams,
): NonNullable<ListLedgerEntriesInput["filters"]> {
  const { from, to } = range(sp);
  const type = one(sp, "type");
  const party = one(sp, "party");
  const partner = uuid(sp, "partner");
  const product = uuid(sp, "product");
  const ccy = currencySchema.safeParse(one(sp, "ccy"));
  const q = one(sp, "q")?.toUpperCase();
  return {
    ...(from ? { dateFrom: from } : {}),
    ...(to ? { dateTo: to } : {}),
    ...(type && (ENTRY_TYPES as readonly string[]).includes(type)
      ? { entryType: [type as (typeof ENTRY_TYPES)[number]] }
      : {}),
    ...(party && (PARTY_TYPES as readonly string[]).includes(party)
      ? { partyType: party as (typeof PARTY_TYPES)[number] }
      : {}),
    ...(partner ? { partnerId: partner } : {}),
    ...(product ? { productId: product } : {}),
    ...(ccy.success ? { currency: ccy.data } : {}),
    ...(q && ORDER_NO_RE.test(q) ? { orderNo: q } : {}),
  };
}

// ---- Allocations (orders are fetched newest-first; narrowed here before the per-order fan-out) --

export interface AllocationFilters {
  from?: string;
  to?: string;
  q?: string;
  product?: string;
  partner?: string;
  version?: string;
}
export function parseAllocationFilters(sp: SearchParams): AllocationFilters {
  return {
    ...range(sp),
    q: one(sp, "q"),
    product: one(sp, "product"),
    partner: one(sp, "partner"),
    version: one(sp, "version"),
  };
}
/** Order-level part (date + order number) so the fan-out only fetches orders that can match. */
export function filterAllocationOrders<T extends { orderNo: string; createdAt: string }>(
  orders: T[],
  f: AllocationFilters,
): T[] {
  return orders.filter((o) => inDateRange(o.createdAt, f.from, f.to) && includes(o.orderNo, f.q));
}
/** Row-level part (product / partner / ownership version). */
export function filterAllocationRows(rows: AllocationRow[], f: AllocationFilters): AllocationRow[] {
  return rows.filter(
    (r) =>
      (!f.product || r.product === f.product) &&
      (!f.partner || r.partners.some((p) => p.name === f.partner)) &&
      (!f.version || r.ownershipVersion === f.version),
  );
}
export const allocationRowFiltersActive = (f: AllocationFilters) =>
  Boolean(f.product || f.partner || f.version);

// ---- Expenses (date + product go to the query; category + text narrow the mapped rows) --------

export interface ExpenseFilters {
  from?: string;
  to?: string;
  /** product uuid, or `company` for expenses with no product */
  product?: string;
  category?: string;
  q?: string;
}
export function parseExpenseFilters(sp: SearchParams): ExpenseFilters {
  const p = one(sp, "product");
  return {
    ...range(sp),
    product: p === "company" ? p : uuid(sp, "product"),
    category: one(sp, "category"),
    q: one(sp, "q"),
  };
}
export function filterExpenseRows(rows: ExpenseRow[], f: ExpenseFilters): ExpenseRow[] {
  return rows.filter(
    (r) =>
      inDateRange(r.at, f.from, f.to) &&
      (!f.category || r.category === f.category) &&
      (f.product !== "company" || !r.product) &&
      (!f.q || includes(r.description, f.q) || includes(r.category, f.q)),
  );
}

// ---- Adjustments + payouts: both lists arrive whole (<= 100, no paging), so the status chip and
// partner select filter them in the screen, driven by the URL so a reload keeps the filter. -------

export interface StatusFilters {
  status?: string;
  partner?: string;
  q?: string;
}
export function parseStatusFilters(sp: SearchParams): StatusFilters {
  return { status: one(sp, "status"), partner: one(sp, "partner"), q: one(sp, "q") };
}
export function filterAdjustmentRows(rows: AdjustmentRow[], f: StatusFilters): AdjustmentRow[] {
  return rows.filter((r) => !f.status || r.status === f.status);
}
export function filterPayoutRows(rows: PayoutRow[], f: StatusFilters): PayoutRow[] {
  return rows.filter(
    (r) =>
      (!f.status || r.status === f.status) &&
      (!f.partner || r.partner === f.partner) &&
      (!f.q || includes(r.reference, f.q) || includes(r.note, f.q)),
  );
}

// ---- Reports ---------------------------------------------------------------------------------

export const REPORT_PRESETS = ["this-month", "last-month", "this-fy", "last-fy", "custom"] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];

export interface ReportFilters {
  preset: ReportPreset;
  dateFrom: string;
  dateTo: string;
  granularity?: "day" | "month" | "fy";
  currency?: "INR" | "native";
  partnerId?: string;
}

/** Calendar bounds for a preset, evaluated in UTC like the rest of the report queries. */
export function presetRange(preset: ReportPreset, now: Date): { dateFrom: string; dateTo: string } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const fyStart = m >= 3 ? y : y - 1;
  if (preset === "last-month")
    return {
      dateFrom: iso(new Date(Date.UTC(y, m - 1, 1))),
      dateTo: iso(new Date(Date.UTC(y, m, 0))),
    };
  if (preset === "last-fy") return { dateFrom: `${fyStart - 1}-04-01`, dateTo: `${fyStart}-03-31` };
  if (preset === "this-month")
    return { dateFrom: iso(new Date(Date.UTC(y, m, 1))), dateTo: iso(now) };
  return { dateFrom: `${fyStart}-04-01`, dateTo: iso(now) };
}

export function parseReportFilters(sp: SearchParams, now = new Date()): ReportFilters {
  const p = one(sp, "preset");
  const preset = (REPORT_PRESETS as readonly string[]).includes(p ?? "")
    ? (p as ReportPreset)
    : "this-fy";
  const base = presetRange(preset === "custom" ? "this-fy" : preset, now);
  const r = range(sp);
  const g = one(sp, "gran");
  const c = one(sp, "ccy");
  const partner = uuid(sp, "partner");
  return {
    preset,
    dateFrom: preset === "custom" && r.from ? r.from : base.dateFrom,
    dateTo: preset === "custom" && r.to ? r.to : base.dateTo,
    ...(g === "day" || g === "month" || g === "fy" ? { granularity: g } : {}),
    ...(c === "INR" || c === "native" ? { currency: c } : {}),
    ...(partner ? { partnerId: partner } : {}),
  };
}

/** Per-partner reports carry a `partnerId` column; keep one partner's rows and re-sum the totals. */
export function filterReportByPartner(result: ReportResult, partnerId?: string): ReportResult {
  if (!partnerId || !result.columns.some((c) => c.key === "partnerId")) return result;
  const rows = result.rows.filter((r) => r.partnerId === partnerId);
  const totals = { ...result.totals };
  for (const c of result.columns) {
    if (c.kind === "money" || c.kind === "count") {
      totals[c.key] = rows.reduce(
        (s, r) => s + (typeof r[c.key] === "number" ? (r[c.key] as number) : 0),
        0,
      );
    }
  }
  return { ...result, rows, totals };
}
