import { CustomerDetail } from "@/components/admin/commerce/CustomerDetail";
import { CUSTOMER_DETAIL, NOW, href } from "../../../_fixtures/admin";
import { PreviewShell } from "../../_shell";

export const metadata = { title: "SCR-ADM-11 · Customer detail" };

export default function Page() {
  return (
    <PreviewShell
      active="/customers"
      title="Ravi Kumar"
      breadcrumbs={[{ label: "Customers", href: href("/customers") }, { label: "Ravi Kumar" }]}
    >
      <CustomerDetail
        data={CUSTOMER_DETAIL}
        now={NOW}
        orderHref={href("/orders") + "/detail"}
        queriesHref={href("/queries")}
        quotesHref={href("/quotes")}
        newOrderHref={href("/orders/new")}
        auditHref={href("/audit")}
      />
    </PreviewShell>
  );
}
