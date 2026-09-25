import { LandingEditor } from "@/components/admin/content/LandingEditor";
import { LANDING_CHAPTERS, SERVICES } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-23 · Content: landing chapters" };

export default function Page() {
  return (
    <PreviewShell
      active="/content/landing"
      title="Landing page"
      breadcrumbs={[{ label: "Content" }, { label: "Landing" }]}
    >
      <LandingEditor
        chapters={LANDING_CHAPTERS}
        services={SERVICES}
        publishedProducts={["FitDesk Pro", "TradeFlow", "InvoiceKit"]}
        featured={["FitDesk Pro", "TradeFlow"]}
        canPublish
      />
    </PreviewShell>
  );
}
