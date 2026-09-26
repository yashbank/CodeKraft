import { LegalEditor } from "@/components/admin/content/LegalEditor";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { contentService } from "@/modules/content/service";

export const dynamic = "force-dynamic";

export default async function AdminLegalEditorPage() {
  const ctx = await getAdminRequestContext();
  const pages = await contentService.listLegalPagesAdmin(ctx);
  return <LegalEditor pages={pages} isSuperAdmin={ctx.roles.includes("super_admin")} />;
}
