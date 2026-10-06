import { Banner } from "@/components/admin/Banner";
import { PageHeader } from "@/components/admin/PageHeader";
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
    // The list cap is 100 (`LIST_LIMIT_MAX`); a larger limit fails validation and used to render
    // an empty ledger with no error.
    listLedgerEntriesQuery({ limit: 100 }, ctx),
    // `listPartners` needs `finance.ledger.read_all` or `users.admin.manage`; an admin without
    // either still gets the page, just with short partner ids instead of names (see finance-view).
    listPartnersQuery({ limit: 100 }, ctx).catch(() => ({ ok: false as const })),
  ]);

  if (!ledgerResult.ok) {
    console.error("[finance/ledger] listLedgerEntries failed", ledgerResult.error);
    return (
      <div className="space-y-4 p-6">
        <PageHeader title="Ledger" />
        <Banner tone="danger" role="alert" title="The ledger could not be loaded">
          {ledgerResult.error.message} Refresh the page to retry. Entries are not shown as empty;
          this is a load failure.
        </Banner>
      </div>
    );
  }

  const items = ledgerResult.data.items;
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
