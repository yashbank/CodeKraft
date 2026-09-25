import { ServicesEditor } from "@/components/admin/content/ServicesEditor";
import { SERVICES } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-24 · Content: services" };

export default function Page() {
  return (
    <PreviewShell
      active="/content/services"
      title="Services"
      summary="5 services"
      breadcrumbs={[{ label: "Content" }, { label: "Services" }]}
    >
      <ServicesEditor services={SERVICES} />
    </PreviewShell>
  );
}
