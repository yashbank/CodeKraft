import { ProductsList } from "@/components/admin/catalog/ProductsList";
import { CATEGORIES, PRODUCTS, TAGS, NOW, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-03 · Products list" };

export default function Page() {
  return (
    <PreviewShell active="/products" title="Products" summary="8 products · 1 pending approval">
      <ProductsList
        products={PRODUCTS}
        categories={CATEGORIES}
        tags={TAGS}
        now={NOW}
        editorHref={href("/products/new")}
        approvalsHref={href("/approvals")}
        approvers={["Arjun Mehta"]}
      />
    </PreviewShell>
  );
}
