import { LedgerScreen } from "@/components/admin/finance/LedgerScreen";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapLedgerEntries } from "@/lib/admin/finance-view";
import { listLedgerEntriesQuery } from "@/modules/finance/queries";
import { listPartnersQuery } from "@/modules/users/queries";

export const dynamic = "force-dynamic";

export default async function AdminLedgerPage() {
  const ctx = await getAdminRequestContext();
  const now = new Date().toISOString();

  const [ledgerResult, partnersResult] = await Promise.all([
    listLedgerEntriesQuery({ limit: 200 }, ctx),
    // `listPartners` needs `finance.ledger.read_all` or `users.admin.manage`; an admin without
    // either still gets the page, just with short partner ids instead of names (see finance-view).
    listPartnersQuery({ limit: 200 }, ctx).catch(() => ({ ok: false as const })),
  ]);

  const items = ledgerResult.ok ? ledgerResult.data.items : [];
  const partnerNames = new Map(
    "data" in partnersResult && partnersResult.ok
      ? partnersResult.data.items.map((p) => [p.id, p.displayName] as const)
      : [],
  );

  const entries = mapLedgerEntries(items, partnerNames);
  const lastPostedAt = entries[0]?.at ?? now;

  return (
    <LedgerScreen
      entries={entries}
      now={now}
      lastPostedAt={lastPostedAt}
      orderHref="/admin/orders"
      adjustmentsHref="/admin/finance/adjustments"
      approvalsHref="/admin/approvals"
      isSuperAdmin={ctx.roles.includes("super_admin")}
    />
  );
}
