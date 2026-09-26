import { ReportsScreen } from "@/components/admin/finance/ReportsScreen";
import {
  CUSTOMER_CREDITS,
  REPORTS,
  STATEMENT_HISTORY,
  STATEMENT_PREVIEW,
} from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminReportsPage() {
  return (
    <ReportsScreen
      reports={REPORTS}
      customerCredits={CUSTOMER_CREDITS}
      partners={["Priya Nair", "Arjun Patel"]}
      statement={STATEMENT_PREVIEW}
      statementHistory={STATEMENT_HISTORY}
      isSuperAdmin={true}
    />
  );
}
