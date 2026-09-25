import { ProductEditor } from "@/components/admin/catalog/ProductEditor";
import { PRODUCT_EDITOR, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-04 · Product editor" };

export default function Page() {
  return (
    <PreviewShell
      active="/products"
      title="FitDesk Pro"
      summary="Published · v2.4.0"
      breadcrumbs={[{ label: "Products", href: href("/products") }, { label: "FitDesk Pro" }]}
    >
      <ProductEditor
        product={PRODUCT_EDITOR}
        approvers={["Arjun Mehta"]}
        listHref={href("/products")}
        approvalsHref={href("/approvals")}
        currencies={["INR", "USD", "EUR"]}
        gstinConfigured
      />
    </PreviewShell>
  );
}
