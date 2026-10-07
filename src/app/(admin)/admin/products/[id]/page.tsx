import { notFound } from "next/navigation";

import { ProductEditor } from "@/components/admin/catalog/ProductEditor";
import type { ProductEditorData } from "@/components/admin/types";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { flattenCategoryNames, mapCategoryNode, mapProductGraphToEditorData } from "@/lib/admin/catalog-view";
import { getProductAdminQuery, listCategoriesQuery } from "@/modules/catalog/queries";
import { listAdminDirectoryQuery } from "@/modules/approvals/queries";
import { listPartnersQuery } from "@/modules/users/queries";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

const EMPTY_PRODUCT: ProductEditorData = {
  id: "new",
  name: "",
  slug: "",
  shortDescription: "",
  category: "Uncategorized",
  categoryId: undefined,
  tags: [],
  status: "draft",
  flags: [],
  currentVersion: "",
  description: "",
  features: [],
  benefits: [],
  techStack: [],
  liveDemoUrl: undefined,
  media: [],
  storageUsedMb: 0,
  storageCapMb: 500,
  offerings: [],
  ownership: [],
  partners: [],
  seo: { title: "", description: "", canonical: undefined },
  blog: { title: "", slug: "", excerpt: "", status: "draft" },
  versions: [],
  testimonials: [],
  faqs: [],
  approval: undefined,
  savedAgoSeconds: 0,
  updatedAt: new Date().toISOString(),
  orderCount: 0,
};

export default async function AdminProductEditorPage({ params }: PageProps) {
  const { id } = await params;
  const isNew = id === "new";

  const ctx = await getAdminRequestContext();

  const [categoriesResult, partnersResult] = await Promise.all([
    listCategoriesQuery({}, ctx),
    // `listPartners` needs `finance.ledger.read_all` or `users.admin.manage`; an admin without
    // either still gets the editor, just with an empty partner picker for ownership proposals.
    listPartnersQuery({ limit: 100 }, ctx).catch(() => ({ ok: false as const })),
  ]);

  const catalogCategories = categoriesResult.ok ? categoriesResult.data : [];
  const categories = catalogCategories.map(mapCategoryNode);
  const partners =
    "data" in partnersResult && partnersResult.ok
      ? partnersResult.data.items.map((p) => ({ id: p.id, name: p.displayName }))
      : [];

  let product: ProductEditorData;
  if (isNew) {
    product = EMPTY_PRODUCT;
  } else {
    const graphResult = await getProductAdminQuery({ productId: id }, ctx);
    if (!graphResult.ok) notFound();
    const categoryNames = flattenCategoryNames(catalogCategories);
    const categoryName = graphResult.data.product.categoryId
      ? (categoryNames.get(graphResult.data.product.categoryId) ?? "Uncategorized")
      : "Uncategorized";
    product = mapProductGraphToEditorData(graphResult.data, { categoryName, partners });
  }

  // Real approvers: every other active admin-class user (same rule the server applies).
  const adminDirectory = await listAdminDirectoryQuery({}, ctx).catch(() => ({ ok: false as const }));
  const approvers = adminDirectory.ok
    ? adminDirectory.data.items.filter((a) => a.id !== ctx.userId).map((a) => a.name)
    : [];

  return (
    <ProductEditor
      product={product}
      categories={categories}
      approvers={approvers}
      listHref="/admin/products"
      approvalsHref="/admin/approvals"
      currencies={["INR", "USD"]}
      gstinConfigured={true}
      isNew={isNew}
    />
  );
}
