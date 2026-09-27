import { DeliveryTasksScreen } from "@/components/admin/commerce/DeliveryTasksScreen";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapDeliveryTaskRow } from "@/lib/admin/delivery-view";
import { listDeliveryTasksQuery } from "@/modules/delivery/queries";
import { listAdminUsersQuery } from "@/modules/users/queries";

export const dynamic = "force-dynamic";

export default async function AdminDeliveryTasksPage() {
  const ctx = await getAdminRequestContext();
  const [tasksResult, adminsResult] = await Promise.all([
    listDeliveryTasksQuery({ limit: 100, filters: {} }, ctx),
    listAdminUsersQuery({}, ctx),
  ]);

  const tasks = tasksResult.ok ? tasksResult.data.items.map(mapDeliveryTaskRow) : [];
  const admins = adminsResult.ok
    ? adminsResult.data.items
        .filter((a) => a.status !== "invited")
        .map((a) => ({ id: a.id, name: a.name, email: a.email, role: a.role }))
    : [];

  return (
    <DeliveryTasksScreen
      tasks={tasks}
      admins={admins}
      now={new Date().toISOString()}
      orderHref="/admin/orders"
      customerHref="/admin/customers"
    />
  );
}
