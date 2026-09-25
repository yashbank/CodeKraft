import { LegalPage } from "@/components/site/LegalPage";

import { LEGAL_NAV, LEGAL_PRIVACY } from "../../_fixtures/site";
import { SitePreview } from "../_shared";

export const metadata = { title: "SCR-SITE-10 Legal page" };

export default function Page() {
  return (
    <SitePreview href="/dev/screens/site/legal" currentPath="/legal/privacy">
      <LegalPage page={LEGAL_PRIVACY} nav={LEGAL_NAV} />
    </SitePreview>
  );
}
