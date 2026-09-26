import { LandingEditor } from "@/components/admin/content/LandingEditor";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { contentService } from "@/modules/content/service";
import { catalogService } from "@/modules/catalog/service";

export const dynamic = "force-dynamic";

export default async function AdminLandingEditorPage() {
  const ctx = await getAdminRequestContext();
  const [chapters, services, featuredIds, productsPage] = await Promise.all([
    contentService.listLandingChaptersAdmin(ctx),
    contentService.listServicesAdmin(ctx),
    contentService.getFeaturedProductIdsAdmin(ctx),
    catalogService.listProductsAdmin(ctx, { limit: 100 }),
  ]);

  const publishedProducts = productsPage.items
    .filter((p) => p.status === "published")
    .map((p) => ({ id: p.id, name: p.name }));

  return (
    <LandingEditor
      chapters={chapters}
      services={services}
      publishedProducts={publishedProducts}
      featuredIds={featuredIds}
      canPublish={ctx.permissions.has("content.publish")}
    />
  );
}
