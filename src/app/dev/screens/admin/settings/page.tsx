import { SettingsScreen } from "@/components/admin/system/SettingsScreen";
import { SETTINGS, href } from "../../_fixtures/admin";
import { PreviewShell } from "../_shell";

export const metadata = { title: "SCR-ADM-29 · Settings" };

export default function Page() {
  return (
    <PreviewShell
      active="/settings"
      title="Settings"
      breadcrumbs={[{ label: "System" }, { label: "Settings" }]}
    >
      <SettingsScreen
        settings={SETTINGS}
        isSuperAdmin
        environment="staging"
        chatbotHref={href("/chatbot")}
        auditHref={href("/audit")}
      />
    </PreviewShell>
  );
}
