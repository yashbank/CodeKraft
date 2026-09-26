import { QuotesScreen } from "@/components/admin/commerce/QuotesScreen";
import {
  CUSTOMER_OPTIONS,
  QUOTES,
} from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminQuotesPage() {
  return (
    <QuotesScreen
      quotes={QUOTES}
      customers={CUSTOMER_OPTIONS}
      orderHref="/admin/orders"
      customerHref="/admin/customers"
    />
  );
}
