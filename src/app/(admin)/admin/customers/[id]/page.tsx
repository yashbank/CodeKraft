import { CustomerDetail } from "@/components/admin/commerce/CustomerDetail";
import { CUSTOMER_DETAIL } from "@/app/dev/screens/_fixtures/admin";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function AdminCustomerDetailPage({ params }: PageProps) {
  const { id } = await params;

  const data = {
    ...CUSTOMER_DETAIL,
    customer: {
      ...CUSTOMER_DETAIL.customer,
      id,
    },
  };

  return (
    <CustomerDetail
      data={data}
      now={new Date().toISOString()}
      orderHref="/admin/orders"
      queriesHref="/admin/queries"
      quotesHref="/admin/quotes"
      newOrderHref="/admin/orders/new"
      auditHref="/admin/audit"
    />
  );
}
