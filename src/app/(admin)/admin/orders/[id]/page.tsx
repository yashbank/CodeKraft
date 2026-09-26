import { OrderDetail } from "@/components/admin/commerce/OrderDetail";
import { ORDER_DETAIL, ORDER_DETAIL_PAID } from "@/app/dev/screens/_fixtures/admin";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  const data = id.includes("paid") || id === "ord-12"
    ? ORDER_DETAIL_PAID
    : ORDER_DETAIL;

  return (
    <OrderDetail
      data={data}
      approvers={["Priya Nair", "Arjun Patel"]}
      isSuperAdmin={true}
      customerHref="/admin/customers"
      ledgerHref="/admin/finance/ledger"
      approvalsHref="/admin/approvals"
      queriesHref="/admin/queries"
    />
  );
}
