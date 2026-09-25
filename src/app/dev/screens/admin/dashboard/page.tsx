import { AdminDashboard } from "@/components/admin/dashboard/AdminDashboard";
import { DASHBOARD, PREVIEW_ROUTES } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-02 · Dashboard" };

export default function Page() {
  return (
    <PreviewShell
      active="/dashboard"
      title="Dashboard"
      summary="3 payments awaiting confirmation · 1 publish approval · 4 new leads"
    >
      <AdminDashboard
        data={DASHBOARD}
        layout={[
          "payments_awaiting",
          "publish_approvals",
          "split_approvals",
          "revenue_by_period",
          "revenue_by_product",
          "my_share",
          "outstanding_payouts",
          "expenses_vs_profit",
          "service_checklists",
          "revocation_tasks",
          "new_leads",
          "pipeline_funnel",
          "overdue_follow_ups",
          "conversion_rate",
          "open_queries",
          "visits_top_products",
          "chatbot_usage",
          "catalog_status",
          "new_customers",
          "system_health",
        ]}
        isSuperAdmin
        greeting="Good morning, Priya"
        dateLabel="Friday, 25 Sep 2026"
        routes={PREVIEW_ROUTES}
      />
    </PreviewShell>
  );
}
