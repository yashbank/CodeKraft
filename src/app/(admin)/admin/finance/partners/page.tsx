import { PartnersPayouts } from "@/components/admin/finance/PartnersPayouts";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import {
  LEDGER_ROLLUP_LIMIT,
  buildPartnerNameMaps,
  computeCompanyTotals,
  computePartnerRollup,
  mapAppliedPayoutToRow,
  mapPartnerBalanceToRow,
  mapPayoutApprovalToRow,
} from "@/lib/admin/finance-view";
import { getPartnerBalancesQuery, listLedgerEntriesQuery, listPayoutsQuery } from "@/modules/finance/queries";
import { listApprovalsAction } from "@/modules/approvals/queries";
import { listPartnersQuery } from "@/modules/users/queries";
import type { PayoutRow } from "@/components/admin/types";

export const dynamic = "force-dynamic";

export default async function AdminPartnersPayoutsPage() {
  const ctx = await getAdminRequestContext();
  const isSuperAdmin = ctx.roles.includes("super_admin");

  const [partnersResult, balancesResult, payoutsResult, payoutApprovalsResult] = await Promise.all([
    listPartnersQuery({ limit: 200 }, ctx).catch(() => ({ ok: false as const })),
    getPartnerBalancesQuery({}, ctx).catch(() => ({ ok: false as const })),
    listPayoutsQuery({ limit: 100 }, ctx),
    listApprovalsAction({ filters: { type: "payout.record" }, limit: 100 }, ctx),
    // `listLedgerEntries` for the applied-payout -> ledger-seq lookup is fetched below, once we
    // know which payouts came back.
  ]);

  const partnerViews = "data" in partnersResult && partnersResult.ok ? partnersResult.data.items : [];
  const { byPartnerId: partnerNames, byUserId: userNames } = buildPartnerNameMaps(partnerViews);
  const balances = "data" in balancesResult && balancesResult.ok ? balancesResult.data : [];
  const balanceByPartnerId = new Map(balances.map((b) => [b.partnerId, b]));
  const payouts = payoutsResult.ok ? payoutsResult.data.items : [];
  const payoutApprovals = payoutApprovalsResult.ok ? payoutApprovalsResult.data.items : [];

  const [payoutLedgerResult, ...rollupResults] = await Promise.all([
    payouts.length > 0
      ? listLedgerEntriesQuery({ filters: { entryType: ["payout"] }, limit: 200 }, ctx)
      : Promise.resolve({ ok: true as const, data: { items: [] as never[], nextCursor: null } }),
    ...partnerViews.map((p) =>
      listLedgerEntriesQuery(
        {
          filters: {
            partnerId: p.id,
            entryType: ["partner_allocation", "refund_partner_allocation", "expense", "payout"],
          },
          sort: "seq:desc",
          limit: LEDGER_ROLLUP_LIMIT,
        },
        ctx,
      ),
    ),
  ]);

  const payoutSeqByPayoutId = new Map<string, number>();
  if (payoutLedgerResult.ok) {
    for (const e of payoutLedgerResult.data.items) {
      if (e.links.payoutId) payoutSeqByPayoutId.set(e.links.payoutId, e.seq);
    }
  }

  const partners = partnerViews.map((p, i) => {
    const balance = balanceByPartnerId.get(p.id);
    const rollupResult = rollupResults[i];
    const entries = rollupResult && rollupResult.ok ? rollupResult.data.items : [];
    const rollup = computePartnerRollup(entries, balance?.balanceInrMinor ?? 0);
    const pendingPayoutApprovals = payoutApprovals.filter(
      (a) => a.status === "pending" && (a.payload as { partnerId?: string }).partnerId === p.id,
    ).length;
    return mapPartnerBalanceToRow({
      partner: p,
      balanceInrMinor: balance?.balanceInrMinor ?? 0,
      perCurrency: balance?.byCurrency.map((c) => ({ currency: c.currency, balance: c.balance })) ?? [],
      rollup,
      pendingPayoutApprovals,
    });
  });

  const appliedRows: PayoutRow[] = payouts.map((payout) =>
    mapAppliedPayoutToRow(payout, {
      partnerNames,
      userNames,
      ledgerSeq: payoutSeqByPayoutId.get(payout.id),
    }),
  );
  const pendingOrRejectedRows: PayoutRow[] = payoutApprovals
    .filter((a) => a.status !== "applied")
    .map((a) => mapPayoutApprovalToRow(a, { partnerNames, userNames }));
  const payoutRows = [...appliedRows, ...pendingOrRejectedRows].sort((a, b) =>
    a.paidOn < b.paidOn ? 1 : -1,
  );

  let company: { companyCutInr: number; companyExpensesInr: number; netInr: number } | undefined;
  if (isSuperAdmin) {
    const companyLedgerResult = await listLedgerEntriesQuery(
      { filters: { entryType: ["company_cut", "expense"] }, limit: LEDGER_ROLLUP_LIMIT },
      ctx,
    ).catch(() => ({ ok: false as const }));
    if ("data" in companyLedgerResult && companyLedgerResult.ok) {
      company = computeCompanyTotals(companyLedgerResult.data.items);
    }
  }

  return (
    <PartnersPayouts
      partners={partners}
      company={company}
      payouts={payoutRows}
      approvers={partnerViews.map((p) => p.displayName)}
      isSuperAdmin={isSuperAdmin}
      statementsHref="/admin/finance/reports"
      ledgerHref="/admin/finance/ledger"
      approvalsHref="/admin/approvals"
    />
  );
}
