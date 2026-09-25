import { AdjustmentsScreen } from "@/components/admin/finance/AdjustmentsScreen";
import { ADJUSTMENTS, PARTNER_BALANCES, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-21 · Finance: adjustments" };

export default function Page() {
  return (
    <PreviewShell
      active="/finance/adjustments"
      title="Adjustments"
      breadcrumbs={[{ label: "Finance" }, { label: "Adjustments" }]}
    >
      <AdjustmentsScreen
        adjustments={ADJUSTMENTS}
        partners={PARTNER_BALANCES}
        approvers={["Arjun Mehta"]}
        approvalsHref={href("/approvals")}
        ledgerHref={href("/finance/ledger")}
      />
    </PreviewShell>
  );
}
