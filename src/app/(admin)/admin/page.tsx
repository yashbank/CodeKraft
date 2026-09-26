import { AdminDashboard } from "@/components/admin/dashboard/AdminDashboard";
import { DASHBOARD } from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminDashboardPage() {
  return (
    <AdminDashboard
      data={DASHBOARD}
      isSuperAdmin={true}
      greeting="Welcome back, Priya"
      dateLabel="FY 2026–27 · Today"
    />
  );
}
