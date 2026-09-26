import { CaseStudiesEditor } from "@/components/admin/content/CaseStudiesEditor";
import { CASE_STUDIES } from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminCaseStudiesEditorPage() {
  return <CaseStudiesEditor caseStudies={CASE_STUDIES} />;
}
