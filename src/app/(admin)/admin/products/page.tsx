import { ProductsList } from "@/components/admin/catalog/ProductsList";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapCategoryNode, mapProductRow } from "@/lib/admin/catalog-view";
import { listCategoriesQuery, listProductsAdminQuery } from "@/modules/catalog/queries";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const ctx = await getAdminRequestContext();
  const [productsResult, categoriesResult] = await Promise.all([
    listProductsAdminQuery({ limit: 100 }, ctx),
    listCategoriesQuery({}, ctx),
  ]);

  const products = productsResult.ok ? productsResult.data.items.map(mapProductRow) : [];
  const categories = categoriesResult.ok ? categoriesResult.data.map(mapCategoryNode) : [];

  // No `listTags` query exists in `modules/catalog` (only per-product tags via `getProductAdmin`
  // and `upsertTag` to create one) -- the categories/tags side panel therefore has nothing to
  // list here beyond what admins add going forward. See the phase report.
  const tags: string[] = [];

  return (
    <ProductsList
      products={products}
      categories={categories}
      tags={tags}
      now={new Date().toISOString()}
      editorHref="/admin/products"
      approvalsHref="/admin/approvals"
      approvers={["Priya Nair", "Arjun Patel"]}
      showCategories={false}
    />
  );
}
