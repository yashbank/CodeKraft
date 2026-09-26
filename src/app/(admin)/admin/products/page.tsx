import { ProductsList } from "@/components/admin/catalog/ProductsList";
import {
  CATEGORIES,
  PRODUCTS,
  TAGS,
} from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminProductsPage() {
  return (
    <ProductsList
      products={PRODUCTS}
      categories={CATEGORIES}
      tags={TAGS}
      now={new Date().toISOString()}
      editorHref="/admin/products"
      approvalsHref="/admin/approvals"
      approvers={["Priya Nair", "Arjun Patel"]}
      showCategories={false}
    />
  );
}
