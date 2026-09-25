import { LeadDetail } from "@/components/admin/crm/LeadDetail";
import { LEAD_DETAIL, NOW, href } from "../../../_fixtures/admin";
import { PreviewShell } from "../../_shell";

export const metadata = { title: "SCR-ADM-14 · Lead detail" };

export default function Page() {
  return (
    <PreviewShell
      active="/leads"
      title="Kavya R. · Nimbus Retail"
      breadcrumbs={[{ label: "Leads", href: href("/leads") }, { label: "Kavya R." }]}
    >
      <LeadDetail
        data={LEAD_DETAIL}
        now={NOW}
        newOrderHref={href("/orders/new")}
        quotesHref={href("/quotes")}
        chatbotHref={href("/chatbot")}
        customerHref={href("/customers") + "/detail"}
        productHref={href("/products/new")}
      />
    </PreviewShell>
  );
}
