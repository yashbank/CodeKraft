import { SettingsScreen } from "@/components/admin/system/SettingsScreen";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { getEnv } from "@/lib/env";
import { getSettingsQuery } from "@/modules/settings/queries";
import { mapSiteSettingsToSettingsData } from "@/lib/admin/settings-view";
import { SITE_SETTINGS_DEFAULTS } from "@/modules/settings/contracts";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const ctx = await getAdminRequestContext();
  const isSuperAdmin = ctx.roles.includes("super_admin");

  const settingsRes = await getSettingsQuery({}, ctx);
  const siteSettings = settingsRes.ok ? settingsRes.data.settings : SITE_SETTINGS_DEFAULTS;
  const settings = mapSiteSettingsToSettingsData(siteSettings);

  // Same derivation as `admin/layout.tsx`'s env badge: collapse the 4-value `AppEnv` union down
  // to the 3-value badge the screen expects.
  const appEnv = getEnv().APP_ENV;
  const environment =
    appEnv === "production" ? "production" : appEnv === "staging" ? "staging" : "development";

  return (
    <SettingsScreen
      settings={settings}
      isSuperAdmin={isSuperAdmin}
      environment={environment}
      chatbotHref="/admin/chatbot"
      auditHref="/admin/audit"
    />
  );
}
