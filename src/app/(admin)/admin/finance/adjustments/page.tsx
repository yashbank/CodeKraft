import { AdjustmentsScreen } from "@/components/admin/finance/AdjustmentsScreen";
import {
  ADJUSTMENTS,
  PARTNER_BALANCES,
} from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminAdjustmentsPage() {
  return (
    <AdjustmentsScreen
      adjustments={ADJUSTMENTS}
      partners={PARTNER_BALANCES}
      approvers={["Priya Nair", "Arjun Patel"]}
      ledgerHref="/admin/finance/ledger"
      approvalsHref="/admin/approvals"
    />
  );
}
