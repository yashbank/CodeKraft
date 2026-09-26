import { TestimonialsLogos } from "@/components/admin/content/TestimonialsLogos";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { contentService } from "@/modules/content/service";

export const dynamic = "force-dynamic";

export default async function AdminTestimonialsLogosPage() {
  const ctx = await getAdminRequestContext();
  const [testimonials, logos] = await Promise.all([
    contentService.listTestimonialsAdmin(ctx),
    contentService.listClientLogosAdmin(ctx),
  ]);
  return <TestimonialsLogos testimonials={testimonials} logos={logos} products={[]} />;
}
