import { AllocationsScreen } from "@/components/admin/finance/AllocationsScreen";
import { ALLOCATIONS } from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminAllocationsPage() {
  return (
    <AllocationsScreen
      rows={ALLOCATIONS}
      partners={["Priya Nair", "Arjun Patel"]}
      orderHref="/admin/orders"
      ledgerHref="/admin/finance/ledger"
      productHref="/admin/products"
      isSuperAdmin={true}
    />
  );
}
