import { ExpensesScreen } from "@/components/admin/finance/ExpensesScreen";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { loadExpenseRows } from "@/lib/admin/expenses-data";
import type { SearchParams } from "@/lib/admin/finance-filters";

export const dynamic = "force-dynamic";

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await getAdminRequestContext();
  const { rows, productNames } = await loadExpenseRows(await searchParams, ctx);

  return (
    <ExpensesScreen
      expenses={rows}
      products={[...productNames.entries()].map(([id, name]) => ({ id, name }))}
      ledgerHref="/admin/finance/ledger"
      adjustmentsHref="/admin/finance/adjustments"
      productHref="/admin/products"
    />
  );
}
