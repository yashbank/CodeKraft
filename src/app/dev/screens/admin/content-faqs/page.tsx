import { FaqsEditor } from "@/components/admin/content/FaqsEditor";
import { FAQS } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-27 · Content: FAQs" };

export default function Page() {
  return (
    <PreviewShell
      active="/content/faqs"
      title="FAQs"
      breadcrumbs={[{ label: "Content" }, { label: "FAQs" }]}
    >
      <FaqsEditor faqs={FAQS} products={["FitDesk Pro", "TradeFlow", "ShopSync"]} />
    </PreviewShell>
  );
}
