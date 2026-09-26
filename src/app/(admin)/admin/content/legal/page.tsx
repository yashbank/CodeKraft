import { LegalEditor } from "@/components/admin/content/LegalEditor";
import { LEGAL_PAGES } from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminLegalEditorPage() {
  return (
    <LegalEditor
      pages={LEGAL_PAGES}
      isSuperAdmin={true}
    />
  );
}
