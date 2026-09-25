import { ManualOrderForm } from "@/components/admin/commerce/ManualOrderForm";
import { CUSTOMER_OPTIONS, OFFERING_OPTIONS, PARTNERS, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-08 · Manual / project order" };

export default function Page() {
  return (
    <PreviewShell
      active="/orders"
      title="New manual order"
      breadcrumbs={[{ label: "Orders", href: href("/orders") }, { label: "New manual order" }]}
    >
      <ManualOrderForm
        customers={CUSTOMER_OPTIONS}
        offerings={OFFERING_OPTIONS}
        partners={PARTNERS}
        approvers={["Arjun Mehta"]}
        gstinConfigured
        taxRateBps={1800}
        isSuperAdmin
      />
    </PreviewShell>
  );
}
