import { ReportsScreen } from "@/components/admin/finance/ReportsScreen";
import {
  CUSTOMER_CREDITS,
  REPORTS,
  STATEMENT_HISTORY,
  STATEMENT_PREVIEW,
} from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-22 · Finance: reports & statements" };

export default function Page() {
  return (
    <PreviewShell
      active="/finance/reports"
      title="Reports & statements"
      breadcrumbs={[{ label: "Finance" }, { label: "Reports" }]}
    >
      <ReportsScreen
        reports={REPORTS}
        customerCredits={CUSTOMER_CREDITS}
        partners={["Priya Nair", "Arjun Mehta"]}
        statement={STATEMENT_PREVIEW}
        statementHistory={STATEMENT_HISTORY}
        isSuperAdmin
      />
    </PreviewShell>
  );
}
