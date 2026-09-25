import { CaseStudiesEditor } from "@/components/admin/content/CaseStudiesEditor";
import { CASE_STUDIES } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-25 · Content: case studies" };

export default function Page() {
  return (
    <PreviewShell
      active="/content/case-studies"
      title="Case studies"
      summary="3 case studies"
      breadcrumbs={[{ label: "Content" }, { label: "Case studies" }]}
    >
      <CaseStudiesEditor caseStudies={CASE_STUDIES} />
    </PreviewShell>
  );
}
