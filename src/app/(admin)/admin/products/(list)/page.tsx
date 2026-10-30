import { ProductsList } from "@/components/admin/catalog/ProductsList";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { mapCategoryNode, mapProductRow } from "@/lib/admin/catalog-view";
import { loadProductCovers } from "@/modules/catalog/cover-images";
import { listCategoriesQuery, listProductsAdminQuery } from "@/modules/catalog/queries";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const ctx = await getAdminRequestContext();
  const [productsResult, categoriesResult] = await Promise.all([
    listProductsAdminQuery({ limit: 100 }, ctx),
    listCategoriesQuery({}, ctx),
  ]);

  const baseProducts = productsResult.ok ? productsResult.data.items.map(mapProductRow) : [];
  const covers = await (async () => {
    try {
      const { getDb } = await import("@/lib/db");
      return await loadProductCovers(
        getDb(),
        baseProducts.map((p) => p.id),
      );
    } catch {
      return new Map<string, { url: string }>();
    }
  })();
  const products = baseProducts.map((p) => ({ ...p, coverUrl: covers.get(p.id)?.url }));
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
