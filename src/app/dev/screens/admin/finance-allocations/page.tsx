import { AllocationsScreen } from "@/components/admin/finance/AllocationsScreen";
import { ALLOCATIONS, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-18 · Finance: allocations" };

export default function Page() {
  return (
    <PreviewShell
      active="/finance/allocations"
      title="Allocations"
      breadcrumbs={[{ label: "Finance" }, { label: "Allocations" }]}
    >
      <AllocationsScreen
        rows={ALLOCATIONS}
        partners={["Priya Nair", "Arjun Mehta"]}
        orderHref={href("/orders") + "/detail-paid"}
        ledgerHref={href("/finance/ledger")}
        productHref={href("/products/new")}
        isSuperAdmin
      />
    </PreviewShell>
  );
}
