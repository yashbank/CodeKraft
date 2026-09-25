import { LedgerScreen } from "@/components/admin/finance/LedgerScreen";
import { LEDGER, NOW, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-17 · Finance: ledger" };

export default function Page() {
  return (
    <PreviewShell
      active="/finance/ledger"
      title="Ledger"
      summary="Last posted 2 h ago"
      breadcrumbs={[{ label: "Finance" }, { label: "Ledger" }]}
    >
      <LedgerScreen
        entries={LEDGER}
        now={NOW}
        lastPostedAt="2026-09-25T07:30:00Z"
        orderHref={href("/orders") + "/detail-paid"}
        adjustmentsHref={href("/finance/adjustments")}
        approvalsHref={href("/approvals")}
        isSuperAdmin
      />
    </PreviewShell>
  );
}
