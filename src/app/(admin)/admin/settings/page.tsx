import { SettingsScreen } from "@/components/admin/system/SettingsScreen";
import { SETTINGS } from "@/app/dev/screens/_fixtures/admin";

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  return (
    <SettingsScreen
      settings={SETTINGS}
      isSuperAdmin={true}
      environment="development"
      chatbotHref="/admin/chatbot"
      auditHref="/admin/audit"
    />
  );
}
