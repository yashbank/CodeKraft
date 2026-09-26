import { ExpensesScreen } from "@/components/admin/finance/ExpensesScreen";
import {
  EXPENSES,
  PRODUCTS,
} from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminExpensesPage() {
  return (
    <ExpensesScreen
      expenses={EXPENSES}
      products={PRODUCTS.map((p) => p.name)}
      ledgerHref="/admin/finance/ledger"
      adjustmentsHref="/admin/finance/adjustments"
      productHref="/admin/products"
    />
  );
}
