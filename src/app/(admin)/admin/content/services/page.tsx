import { ServicesEditor } from "@/components/admin/content/ServicesEditor";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { contentService } from "@/modules/content/service";

export const dynamic = "force-dynamic";

export default async function AdminServicesEditorPage() {
  const ctx = await getAdminRequestContext();
  const services = await contentService.listServicesAdmin(ctx);
  return <ServicesEditor services={services} />;
}
