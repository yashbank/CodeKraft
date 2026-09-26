import { InvoicesScreen } from "@/components/account/InvoicesScreen";
import {
  invoices,
  payments,
} from "@/app/dev/screens/_fixtures/account";

export const dynamic = "force-dynamic";

export default function InvoicesPage() {
  return (
    <InvoicesScreen
      invoices={invoices}
      payments={payments}
      financialYears={["FY 2026–27", "FY 2025–26", "all"]}
      links={{
        order: (orderNumber: string) => `/account/orders/${orderNumber}`,
      }}
    />
  );
}
