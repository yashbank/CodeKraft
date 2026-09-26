import { LedgerScreen } from "@/components/admin/finance/LedgerScreen";
import { LEDGER } from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminLedgerPage() {
  return (
    <LedgerScreen
      entries={LEDGER}
      now={new Date().toISOString()}
      lastPostedAt="2026-09-25T08:30:00.000Z"
      orderHref="/admin/orders"
      adjustmentsHref="/admin/finance/adjustments"
      approvalsHref="/admin/approvals"
      isSuperAdmin={true}
    />
  );
}
