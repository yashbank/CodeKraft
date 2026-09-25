import { OrderDetail } from "@/components/admin/commerce/OrderDetail";
import { ORDER_DETAIL, href } from "../../../_fixtures/admin";
import { PreviewShell } from "../../_shell";

export const metadata = { title: "SCR-ADM-07 · Order detail (awaiting confirmation)" };

export default function Page() {
  return (
    <PreviewShell
      active="/orders"
      title="CK-ORD-000012"
      readMostly
      breadcrumbs={[{ label: "Orders", href: href("/orders") }, { label: "CK-ORD-000012" }]}
    >
      <OrderDetail
        data={ORDER_DETAIL}
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
