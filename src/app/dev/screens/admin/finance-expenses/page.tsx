import { ExpensesScreen } from "@/components/admin/finance/ExpensesScreen";
import { EXPENSES, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-20 · Finance: expenses" };

export default function Page() {
  return (
    <PreviewShell
      active="/finance/expenses"
      title="Expenses"
      breadcrumbs={[{ label: "Finance" }, { label: "Expenses" }]}
    >
      <ExpensesScreen
        expenses={EXPENSES}
        products={["FitDesk Pro", "TradeFlow", "ShopSync"]}
        ledgerHref={href("/finance/ledger")}
        adjustmentsHref={href("/finance/adjustments")}
        productHref={href("/products/new")}
      />
    </PreviewShell>
  );
}
