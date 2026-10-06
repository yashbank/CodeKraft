import { AdjustmentsScreen } from "@/components/admin/finance/AdjustmentsScreen";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { buildPartnerNameMaps, mapApprovalToAdjustmentRow, mapPartnerBalanceToRow } from "@/lib/admin/finance-view";
import { getPartnerBalancesQuery, listLedgerEntriesQuery } from "@/modules/finance/queries";
import { listApprovalsAction } from "@/modules/approvals/queries";
import { listPartnersQuery } from "@/modules/users/queries";

export const dynamic = "force-dynamic";

export default async function AdminAdjustmentsPage() {
  const ctx = await getAdminRequestContext();

  const [approvalsResult, partnersResult, balancesResult] = await Promise.all([
    listApprovalsAction({ filters: { type: "ledger.adjustment" }, limit: 100 }, ctx),
    listPartnersQuery({ limit: 100 }, ctx).catch(() => ({ ok: false as const })),
    getPartnerBalancesQuery({}, ctx).catch(() => ({ ok: false as const })),
  ]);

  const approvals = approvalsResult.ok ? approvalsResult.data.items : [];
  const partnerViews = "data" in partnersResult && partnersResult.ok ? partnersResult.data.items : [];
  const { byPartnerId: partnerNames, byUserId: userNames } = buildPartnerNameMaps(partnerViews);
  const balances = "data" in balancesResult && balancesResult.ok ? balancesResult.data : [];
  const balanceByPartnerId = new Map(balances.map((b) => [b.partnerId, b.balanceInrMinor]));

  // Ledger seqs for applied adjustments -- `ApprovalView` doesn't carry the posted entry ids.
  const appliedIds = approvals.filter((a) => a.status === "applied").map((a) => a.id);
  const ledgerByApproval = new Map<string, number[]>();
  await Promise.all(
    appliedIds.map(async (approvalRequestId) => {
      const result = await listLedgerEntriesQuery(
        { filters: { approvalRequestId }, limit: 100 },
        ctx,
      );
      if (result.ok) {
        ledgerByApproval.set(
          approvalRequestId,
          result.data.items.map((e) => e.seq).sort((a, b) => a - b),
        );
      }
    }),
  );

  const adjustments = approvals.map((a) =>
    mapApprovalToAdjustmentRow(a, {
      partnerNames,
      userNames,
      ledgerSeqs: ledgerByApproval.get(a.id),
    }),
  );

  const partners = partnerViews.map((p) =>
    mapPartnerBalanceToRow({
      partner: p,
      balanceInrMinor: balanceByPartnerId.get(p.id) ?? 0,
      perCurrency: [],
      rollup: { earnedInrMinor: 0, paidOutInrMinor: 0, history: [], sparkline: [0] },
      pendingPayoutApprovals: 0,
    }),
  );

  return (
    <AdjustmentsScreen
      adjustments={adjustments}
      partners={partners}
      approvers={partnerViews.map((p) => p.displayName)}
      ledgerHref="/admin/finance/ledger"
      approvalsHref="/admin/approvals"
    />
  );
}
