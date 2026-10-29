import { ExpensesScreen } from "@/components/admin/finance/ExpensesScreen";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import {
  filterExpenseRows,
  parseExpenseFilters,
  type SearchParams,
} from "@/lib/admin/finance-filters";
import {
  buildExpenseLedgerIndex,
  buildPartnerNameMaps,
  mapExpenseToRow,
} from "@/lib/admin/finance-view";
import { listExpensesQuery, listLedgerEntriesQuery } from "@/modules/finance/queries";
import { listProductsAdminQuery } from "@/modules/catalog/queries";
import { listPartnersQuery } from "@/modules/users/queries";

export const dynamic = "force-dynamic";

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = parseExpenseFilters(await searchParams);
  const ctx = await getAdminRequestContext();

  const [expensesResult, productsResult, partnersResult, expenseLedgerResult] = await Promise.all([
    listExpensesQuery(
      {
        limit: 100,
        filters: {
          ...(filters.from ? { dateFrom: filters.from } : {}),
          ...(filters.to ? { dateTo: filters.to } : {}),
          ...(filters.product && filters.product !== "company"
            ? { productId: filters.product }
            : {}),
        },
      },
      ctx,
    ),
    listProductsAdminQuery({ limit: 100 }, ctx).catch(() => ({ ok: false as const })),
    listPartnersQuery({ limit: 100 }, ctx).catch(() => ({ ok: false as const })),
    // Cross-referenced against `expenses.id` via `links.expenseId` to recover the ledger seq(s)
    // and INR total each expense posted -- `listExpenses`/`Expense` carry neither.
    listLedgerEntriesQuery({ filters: { entryType: ["expense"] }, limit: 100 }, ctx),
  ]);

  const expenses = expensesResult.ok ? expensesResult.data.items : [];
  const productNames = new Map(
    "data" in productsResult && productsResult.ok
      ? productsResult.data.items.map((p) => [p.id, p.name] as const)
      : [],
  );
  const { byUserId: userNames } = buildPartnerNameMaps(
    "data" in partnersResult && partnersResult.ok ? partnersResult.data.items : [],
  );
  const ledgerIndex = buildExpenseLedgerIndex(
    expenseLedgerResult.ok ? expenseLedgerResult.data.items : [],
  );

  const rows = filterExpenseRows(
    expenses.map((exp) => mapExpenseToRow(exp, { productNames, userNames, ledgerIndex })),
    filters,
  );

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
