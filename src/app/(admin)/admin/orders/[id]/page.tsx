import { OrderDetail } from "@/components/admin/commerce/OrderDetail";
import { EmptyState } from "@/components/admin/EmptyState";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapOrderDetailToOrderDetailData } from "@/lib/admin/orders-view";
import { listAuditLogsAction } from "@/modules/audit/queries";
import { getOrderAllocationQuery, listLedgerEntriesQuery } from "@/modules/finance/queries";
import { getOrderAdminQuery } from "@/modules/orders/queries";
import { listPartnersQuery } from "@/modules/users/queries";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

/** Statuses for which `finance.getOrderAllocation` has a row to return (posted at payment time). */
const ALLOCATED_STATUSES = new Set(["paid", "fulfilled", "refunded", "partially_refunded"]);

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await getAdminRequestContext();
  const now = new Date().toISOString();

  const detailResult = await getOrderAdminQuery({ orderId: id }, ctx);
  if (!detailResult.ok) {
    return (
      <EmptyState title="Order not found" body={detailResult.error.message} />
    );
  }
  const detail = detailResult.data;

  const timelineSubjects = [
    { subjectType: "order", subjectId: detail.order.id },
    ...detail.payments.map((p) => ({ subjectType: "payment", subjectId: p.paymentId })),
    ...detail.refunds.map((r) => ({ subjectType: "refund", subjectId: r.refundId })),
  ];

  const [ledgerResult, allocationResult, timelineResults, partnersResult] = await Promise.all([
    listLedgerEntriesQuery({ filters: { orderNo: detail.order.orderNo }, limit: 100 }, ctx),
    ALLOCATED_STATUSES.has(detail.order.status)
      ? getOrderAllocationQuery({ orderId: detail.order.id }, ctx)
      : Promise.resolve(null),
    Promise.all(
      timelineSubjects.map((s) => listAuditLogsAction({ filters: s, limit: 50 }, ctx)),
    ),
    // `listPartners` needs `finance.ledger.read_all` or `users.admin.manage`; an admin without
    // either still gets the page, just with short partner ids instead of names (see orders-view).
    listPartnersQuery({ limit: 100 }, ctx).catch(() => ({ ok: false as const })),
  ]);

  const ledger = ledgerResult.ok ? ledgerResult.data.items : [];
  const allocation = allocationResult && allocationResult.ok ? allocationResult.data : null;
  const timelineRows = timelineResults.flatMap((r) => (r.ok ? r.data.items : []));
  const partnerNames = new Map(
    "data" in partnersResult && partnersResult.ok
      ? partnersResult.data.items.map((p) => [p.id, p.displayName] as const)
      : [],
  );

  const data = mapOrderDetailToOrderDetailData(detail, {
    ledger,
    allocation,
    timelineRows,
    now,
    partnerNames,
  });

  return (
    <OrderDetail
      data={data}
      approvers={["Priya Nair", "Arjun Patel"]}
      isSuperAdmin={ctx.roles.includes("super_admin")}
      customerHref="/admin/customers"
      ledgerHref="/admin/finance/ledger"
      approvalsHref="/admin/approvals"
      queriesHref="/admin/queries"
    />
  );
}
