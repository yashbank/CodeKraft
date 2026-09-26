import { EntitlementsScreen } from "@/components/admin/commerce/EntitlementsScreen";
import {
  ADMINS,
  DELIVERY_TASKS,
  ENTITLEMENTS,
} from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminDeliveryTasksPage() {
  return (
    <EntitlementsScreen
      entitlements={ENTITLEMENTS}
      tasks={DELIVERY_TASKS}
      admins={ADMINS}
      now={new Date().toISOString()}
      orderHref="/admin/orders"
      customerHref="/admin/customers"
      queriesHref="/admin/queries"
      initialView="tasks"
    />
  );
}
