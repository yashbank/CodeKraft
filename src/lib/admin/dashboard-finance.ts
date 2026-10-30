/**
 * R8-04 — the money widgets of the admin dashboard, computed from the ledger (never hard-coded).
 * All amounts are INR minor units (`ledger_entries.amount_inr_minor`), the same unit the
 * widgets' `inr()` formatter expects. Server-only.
 *
 * Sign convention (finance/posting.ts): credits to company/partners are positive, refund
 * reversals negative, so a plain SUM per party is the net figure.
 */
import { sql } from "drizzle-orm";
import { can } from "@/lib/authz/assert";
import type { RequestContext } from "@/lib/authz/context";
import { db } from "@/lib/db";
import type { DashboardData, QueueItem, WidgetKey } from "@/components/admin/types";
import { rawSumsFromRow, rawSumsSql } from "@/modules/finance/metrics-core";
import { buildMyShare } from "./dashboard-finance-core";

type FinanceWidgets = Pick<
  DashboardData,
  | "revenueByProduct"
  | "revenueByPartner"
  | "myShare"
  | "outstandingPayouts"
  | "expensesVsProfit"
  | "paymentsAwaiting"
>;

const EMPTY: FinanceWidgets = {
  revenueByProduct: [],
  revenueByPartner: [],
  myShare: { valueInr: 0, delta: "No data yet", sparkline: [] },
  outstandingPayouts: { totalInr: 0, items: [] },
  expensesVsProfit: [],
  paymentsAwaiting: [],
};

type DateRange = { dateFrom: string; dateTo: string };
/** Inclusive UTC day window, identical to the finance reports / revenue tile. */
const win = (r: DateRange) =>
  sql`le.created_at >= ${`${r.dateFrom}T00:00:00.000Z`} and le.created_at <= ${`${r.dateTo}T23:59:59.999Z`}`;

const n = (v: unknown) => Number(v ?? 0);

/**
 * Net sales (gross list price - discounts/coupons, ex-tax; same definition as finance reports,
 * see modules/finance/metrics.ts) per product over the selected range.
 */
export async function revenueByProduct(range: DateRange) {
  const rows = await db.execute<{ id: string; label: string; value: string }>(sql`
    select p.id as id, p.name as label,
           sum(case when le.entry_type = 'sale' then abs(le.amount_inr_minor)
                    when le.entry_type = 'discount' then -abs(le.amount_inr_minor)
                    else 0 end) as value
    from ledger_entries le
    join order_items oi on oi.id = le.order_item_id
    join products p on p.id = oi.product_id
    where ${win(range)}
    group by p.id, p.name
    having sum(case when le.entry_type = 'sale' then abs(le.amount_inr_minor)
                    when le.entry_type = 'discount' then -abs(le.amount_inr_minor)
                    else 0 end) <> 0
    order by value desc
    limit 8`);
  return [...rows].map((r) => ({ id: r.id, label: r.label, value: n(r.value) }));
}

/** `want` limits which widgets are queried (role allow-list / layout); default = all. */
export async function loadDashboardFinance(
  ctx: RequestContext,
  range: DateRange,
  want: (key: WidgetKey) => boolean = () => true,
): Promise<FinanceWidgets> {
  const out: FinanceWidgets = structuredClone(EMPTY);
  const readAll = can(ctx, "finance.ledger.read_all");

  if (want("payments_awaiting") && can(ctx, "payments.confirm")) {
    const rows = await db.execute<{
      id: string;
      order_no: string;
      name: string | null;
      total_minor: string;
      currency: string;
      status: string;
    }>(sql`
      select o.id, o.order_no, o.billing_snapshot->>'name' as name, o.total_minor, o.currency,
             p.status
      from payments p join orders o on o.id = p.order_id
      where p.status = 'submitted' and o.status = 'pending_payment'
      order by p.customer_submitted_at asc nulls last
      limit 10`);
    out.paymentsAwaiting = [...rows].map((r): QueueItem => ({
      label: `${r.order_no} · ${r.name ?? "Customer"}`,
      meta: `${r.currency} ${(n(r.total_minor) / 100).toFixed(2)} · reference submitted`,
      href: `/orders/${r.id}`,
    }));
  }

  if (readAll && want("revenue_by_product")) out.revenueByProduct = await revenueByProduct(range);

  if (readAll && want("revenue_by_partner")) {
    const partnerRows = await db.execute<{ label: string; value: string }>(sql`
      select pa.display_name as label, sum(le.amount_inr_minor) as value
      from ledger_entries le join partners pa on pa.id = le.partner_id
      where le.entry_type in ('partner_allocation','refund_partner_allocation')
        and ${win(range)}
      group by pa.display_name having sum(le.amount_inr_minor) <> 0
      order by value desc limit 8`);
    out.revenueByPartner = [...partnerRows].map((r) => ({ label: r.label, value: n(r.value) }));
  }

  if (readAll && want("outstanding_payouts")) {
    // Outstanding = allocated - refunded - paid out, per partner (all time).
    const owed = await db.execute<{ id: string; label: string; value: string }>(sql`
      select pa.id, pa.display_name as label, sum(le.amount_inr_minor) as value
      from ledger_entries le join partners pa on pa.id = le.partner_id
      where le.party_type = 'partner'
      group by pa.id, pa.display_name having sum(le.amount_inr_minor) > 0
      order by value desc`);
    const owedRows = [...owed];
    out.outstandingPayouts = {
      totalInr: owedRows.reduce((s, r) => s + n(r.value), 0),
      items: owedRows.slice(0, 6).map((r) => ({
        label: r.label,
        meta: `₹${(n(r.value) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })} owed`,
        href: "/finance/partners",
      })),
    };
  }

  if (readAll && want("expenses_vs_profit")) {
    // Last 6 calendar months: expenses vs profit (company + partner shares net of refunds, minus
    // expenses; floored at 0 because the stacked chart cannot draw a negative bar).
    const months = await db.execute<{ m: string; expenses: string; shares: string }>(sql`
      with months as (
        select to_char(d, 'YYYY-MM') as m
        from generate_series(date_trunc('month', now()) - interval '5 months',
                             date_trunc('month', now()), interval '1 month') d
      )
      select months.m,
        coalesce((select sum(e.amount_minor) from expenses e
                  where to_char(e.incurred_on::date, 'YYYY-MM') = months.m), 0) as expenses,
        coalesce((select sum(le.amount_inr_minor) from ledger_entries le
                  where le.entry_type in ('company_cut','refund_company_cut',
                                          'partner_allocation','refund_partner_allocation')
                    and to_char(le.created_at, 'YYYY-MM') = months.m), 0) as shares
      from months order by months.m`);
    out.expensesVsProfit = [...months].map((r) => ({
      label: r.m,
      expenses: n(r.expenses),
      profit: Math.max(0, n(r.shares) - n(r.expenses)),
    }));
  }

  if (ctx.partnerId && want("my_share")) {
    const sumRows = await db.execute<Record<string, unknown>>(sql`
      select ${rawSumsSql("le")} from ledger_entries le
      where le.partner_id = ${ctx.partnerId} and ${win(range)}`);
    const weeks = await db.execute<{ w: string; value: string }>(sql`
      with weeks as (
        select generate_series(date_trunc('week', now()) - interval '7 weeks',
                               date_trunc('week', now()), interval '1 week') as w
      )
      select weeks.w::text as w, coalesce(sum(le.amount_inr_minor), 0) as value
      from weeks left join ledger_entries le
        on le.partner_id = ${ctx.partnerId}
       and le.entry_type in ('partner_allocation','refund_partner_allocation')
       and date_trunc('week', le.created_at) = weeks.w
      group by weeks.w order by weeks.w`);
    out.myShare = buildMyShare(
      rawSumsFromRow([...sumRows][0] ?? {}),
      [...weeks].map((r) => n(r.value)),
    );
  }

  return out;
}
