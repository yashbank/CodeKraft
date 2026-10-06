import { LeadsScreen } from "@/components/admin/crm/LeadsScreen";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { getCurrentAdminUser } from "@/lib/admin/current-admin";
import { buildAdminNameMap, buildProductNameMap, mapLeadRow } from "@/lib/admin/leads-view";
import { listLeadsQuery, listAssignableAdminsQuery } from "@/modules/leads/queries";
import { listProductsAdminQuery } from "@/modules/catalog/queries";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{
    prefillName?: string;
    prefillEmail?: string;
    prefillPhone?: string;
    prefillCompany?: string;
  }>;
}

export default async function AdminLeadsPage({ searchParams }: PageProps) {
  const ctx = await getAdminRequestContext();
  const sp = await searchParams;

  const [leadsResult, adminsResult, productsResult, currentUser] = await Promise.all([
    listLeadsQuery({ limit: 100 }, ctx),
    listAssignableAdminsQuery({}, ctx),
    // `listProductsAdmin` needs `catalog.read`; an admin with only `leads.read`/`leads.assign`
    // still gets the page, just with short product ids instead of names (see leads-view.ts).
    listProductsAdminQuery({ limit: 200 }, ctx).catch(() => ({ ok: false as const })),
    getCurrentAdminUser(ctx),
  ]);

  const admins = adminsResult.ok ? adminsResult.data.items : [];
  const adminMap = buildAdminNameMap(admins);
  const productNames = buildProductNameMap(
    "data" in productsResult && productsResult.ok
      ? productsResult.data.items.map((p) => ({ id: p.id, name: p.name }))
      : [],
  );

  const leads = leadsResult.ok
    ? leadsResult.data.items.map((l) => mapLeadRow(l, adminMap, productNames))
    : [];

  const products = (
    "data" in productsResult && productsResult.ok ? productsResult.data.items : []
  ).map((p) => ({ id: p.id, name: p.name }));

  return (
    <LeadsScreen
      leads={leads}
      admins={admins}
      currentUser={currentUser}
      now={new Date().toISOString()}
      detailHref="/admin/leads"
      newOrderHref="/admin/orders/new"
      products={products}
      initialNewLead={
        sp.prefillName
          ? {
              name: sp.prefillName,
              email: sp.prefillEmail,
              phone: sp.prefillPhone,
              company: sp.prefillCompany,
            }
          : undefined
      }
    />
  );
}
