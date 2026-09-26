import { FaqsEditor } from "@/components/admin/content/FaqsEditor";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { contentService } from "@/modules/content/service";

export const dynamic = "force-dynamic";

export default async function AdminFaqsEditorPage() {
  const ctx = await getAdminRequestContext();
  const faqs = await contentService.listFaqsAdmin(ctx);
  return <FaqsEditor faqs={faqs} products={[]} />;
}
