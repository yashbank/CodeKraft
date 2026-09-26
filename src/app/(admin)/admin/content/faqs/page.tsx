import { FaqsEditor } from "@/components/admin/content/FaqsEditor";
import { FAQS, PRODUCTS } from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminFaqsEditorPage() {
  return (
    <FaqsEditor
      faqs={FAQS}
      products={PRODUCTS.map((p) => p.name)}
    />
  );
}
