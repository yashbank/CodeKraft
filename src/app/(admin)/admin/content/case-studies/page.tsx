import { CaseStudiesEditor } from "@/components/admin/content/CaseStudiesEditor";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { contentService } from "@/modules/content/service";

export const dynamic = "force-dynamic";

export default async function AdminCaseStudiesEditorPage() {
  const ctx = await getAdminRequestContext();
  const caseStudies = await contentService.listCaseStudiesAdmin(ctx);
  return <CaseStudiesEditor caseStudies={caseStudies} />;
}
