import { LeadsScreen } from "@/components/admin/crm/LeadsScreen";
import {
  ADMINS,
  LEADS,
  PRIYA,
} from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminLeadsPage() {
  return (
    <LeadsScreen
      leads={LEADS}
      admins={ADMINS}
      currentUser={PRIYA}
      now={new Date().toISOString()}
      detailHref="/admin/leads"
      newOrderHref="/admin/orders/new"
    />
  );
}
