import { ServicesEditor } from "@/components/admin/content/ServicesEditor";
import { SERVICES } from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminServicesEditorPage() {
  return <ServicesEditor services={SERVICES} />;
}
