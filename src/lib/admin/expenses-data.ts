import type { ExpenseRow } from "@/components/admin/types";
import type { RequestContext } from "@/lib/authz/context";
import { listProductsAdminQuery } from "@/modules/catalog/queries";
import { listExpensesQuery, listLedgerEntriesQuery } from "@/modules/finance/queries";
import { listPartnersQuery } from "@/modules/users/queries";
import { filterExpenseRows, parseExpenseFilters, type SearchParams } from "./finance-filters";
import { buildExpenseLedgerIndex, buildPartnerNameMaps, mapExpenseToRow } from "./finance-view";

/** Filtered expense rows for the expenses page and its CSV export (one query path, same filters). */
export async function loadExpenseRows(sp: SearchParams, ctx: RequestContext) {
  const filters = parseExpenseFilters(sp);
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
  const rows: ExpenseRow[] = filterExpenseRows(
    expenses.map((exp) => mapExpenseToRow(exp, { productNames, userNames, ledgerIndex })),
    filters,
  );
  return { rows, productNames, ok: expensesResult.ok };
}
