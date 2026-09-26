import { LandingEditor } from "@/components/admin/content/LandingEditor";
import {
  LANDING_CHAPTERS,
  PRODUCTS,
  SERVICES,
} from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminLandingEditorPage() {
  return (
    <LandingEditor
      chapters={LANDING_CHAPTERS}
      services={SERVICES}
      publishedProducts={PRODUCTS.map((p) => p.name)}
      featured={["FitDesk Pro", "TradeFlow"]}
      canPublish={true}
    />
  );
}
