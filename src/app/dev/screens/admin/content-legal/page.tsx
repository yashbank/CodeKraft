import { LegalEditor } from "@/components/admin/content/LegalEditor";
import { LEGAL_PAGES } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-28 · Content: legal pages" };

export default function Page() {
  return (
    <PreviewShell
      active="/content/legal"
      title="Legal pages"
      breadcrumbs={[{ label: "Content" }, { label: "Legal" }]}
    >
      <LegalEditor pages={LEGAL_PAGES} isSuperAdmin />
    </PreviewShell>
  );
}
