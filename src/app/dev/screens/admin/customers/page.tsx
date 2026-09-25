import { CustomersList } from "@/components/admin/commerce/CustomersList";
import { CUSTOMERS, NOW, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-10 · Customers list" };

export default function Page() {
  return (
    <PreviewShell active="/customers" title="Customers" summary="7 customers">
      <CustomersList
        customers={CUSTOMERS}
        now={NOW}
        detailHref={href("/customers") + "/detail"}
        quotesHref={href("/quotes")}
        newOrderHref={href("/orders/new")}
      />
    </PreviewShell>
  );
}
