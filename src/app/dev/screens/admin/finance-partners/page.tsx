import { PartnersPayouts } from "@/components/admin/finance/PartnersPayouts";
import { COMPANY_CARD, PARTNER_BALANCES, PAYOUTS, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-19 · Finance: partners & payouts" };

export default function Page() {
  return (
    <PreviewShell
      active="/finance/partners"
      title="Partners & payouts"
      summary="Outstanding ₹80,480.00"
      breadcrumbs={[{ label: "Finance" }, { label: "Partners & payouts" }]}
    >
      <PartnersPayouts
        partners={PARTNER_BALANCES}
        company={COMPANY_CARD}
        payouts={PAYOUTS}
        approvers={["Arjun Mehta"]}
        isSuperAdmin
        statementsHref={href("/finance/reports")}
        ledgerHref={href("/finance/ledger")}
        approvalsHref={href("/approvals")}
      />
    </PreviewShell>
  );
}
