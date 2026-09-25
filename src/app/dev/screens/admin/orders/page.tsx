import { OrdersList } from "@/components/admin/commerce/OrdersList";
import { ORDERS, NOW, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-06 · Orders list" };

export default function Page() {
  return (
    <PreviewShell active="/orders" title="Orders" readMostly>
      <OrdersList
        orders={ORDERS}
        now={NOW}
        detailHref={href("/orders") + "/detail"}
        newOrderHref={href("/orders/new")}
        customerHref={href("/customers") + "/detail"}
        approvalsHref={href("/approvals")}
        notificationsHref={href("/notifications")}
      />
    </PreviewShell>
  );
}
