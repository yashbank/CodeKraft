import { LeadDetail } from "@/components/admin/crm/LeadDetail";
import { LEAD_DETAIL } from "@/app/dev/screens/_fixtures/admin";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function AdminLeadDetailPage({ params }: PageProps) {
  const { id } = await params;

  const data = {
    ...LEAD_DETAIL,
    lead: {
      ...LEAD_DETAIL.lead,
      id,
    },
  };

  return (
    <LeadDetail
      data={data}
      now={new Date().toISOString()}
      newOrderHref="/admin/orders/new"
      quotesHref="/admin/quotes"
      chatbotHref="/admin/chatbot"
      customerHref="/admin/customers"
      productHref="/admin/products"
    />
  );
}
