import { OrderDetail } from "@/components/admin/commerce/OrderDetail";
import { ORDER_DETAIL_PAID, href } from "../../../_fixtures/admin";
import { PreviewShell } from "../../_shell";

export const metadata = { title: "SCR-ADM-07 · Order detail (paid, fulfilment)" };

export default function Page() {
  return (
    <PreviewShell
      active="/orders"
      title="CK-ORD-000009"
      readMostly
      breadcrumbs={[{ label: "Orders", href: href("/orders") }, { label: "CK-ORD-000009" }]}
    >
      <OrderDetail
        data={ORDER_DETAIL_PAID}
        approvers={["Arjun Mehta"]}
        isSuperAdmin
        customerHref={href("/customers") + "/detail"}
        ledgerHref={href("/finance/ledger")}
        approvalsHref={href("/approvals")}
        queriesHref={href("/queries")}
      />
    </PreviewShell>
  );
}
