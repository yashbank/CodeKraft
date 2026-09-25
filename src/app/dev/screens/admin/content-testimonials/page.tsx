import { TestimonialsLogos } from "@/components/admin/content/TestimonialsLogos";
import { LOGOS, SITE_TESTIMONIALS } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-26 · Content: testimonials & logos" };

export default function Page() {
  return (
    <PreviewShell
      active="/content/testimonials"
      title="Testimonials & logos"
      breadcrumbs={[{ label: "Content" }, { label: "Testimonials & logos" }]}
    >
      <TestimonialsLogos
        testimonials={SITE_TESTIMONIALS}
        logos={LOGOS}
        products={["FitDesk Pro", "TradeFlow", "ShopSync"]}
      />
    </PreviewShell>
  );
}
