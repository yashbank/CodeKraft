import { PartnersPayouts } from "@/components/admin/finance/PartnersPayouts";
import {
  COMPANY_CARD,
  PARTNER_BALANCES,
  PAYOUTS,
} from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminPartnersPayoutsPage() {
  return (
    <PartnersPayouts
      partners={PARTNER_BALANCES}
      company={COMPANY_CARD}
      payouts={PAYOUTS}
      approvers={["Priya Nair", "Arjun Patel"]}
      isSuperAdmin={true}
      statementsHref="/admin/finance/reports"
      ledgerHref="/admin/finance/ledger"
      approvalsHref="/admin/approvals"
    />
  );
}
