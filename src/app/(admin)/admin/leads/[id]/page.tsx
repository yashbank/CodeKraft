import { LeadDetail } from "@/components/admin/crm/LeadDetail";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapLeadDetail } from "@/lib/admin/leads-view";
import { getLeadQuery, listAssignableAdminsQuery } from "@/modules/leads/queries";
import { listProductsAdminQuery } from "@/modules/catalog/queries";
import { EmptyState } from "@/components/admin/EmptyState";
import { TargetIcon } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function AdminLeadDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await getAdminRequestContext();

  const [leadResult, adminsResult, productsResult] = await Promise.all([
    getLeadQuery({ leadId: id }, ctx),
    listAssignableAdminsQuery({}, ctx),
    listProductsAdminQuery({ limit: 100 }, ctx).catch(() => ({ ok: false as const })),
  ]);

  if (!leadResult.ok) {
    return (
      <EmptyState
        icon={TargetIcon}
        title="Lead not found"
        body="It may have been deleted, or you may not have access to it."
      />
    );
  }

  const admins = adminsResult.ok ? adminsResult.data.items : [];
  const productNames = new Map(
    "data" in productsResult && productsResult.ok
      ? productsResult.data.items.map((p) => [p.id, p.name] as const)
      : [],
  );

  const data = mapLeadDetail(leadResult.data, admins, productNames);

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
