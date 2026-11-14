import { SettingsScreen } from "@/components/admin/system/SettingsScreen";
import { getAdminRequestContext } from "@/lib/authz/admin-request-context";
import { getSiteName } from "@/lib/site-brand";
import { getSettingsQuery } from "@/modules/settings/queries";
import { mapSiteSettingsToSettingsData } from "@/lib/admin/settings-view";
import { getFxPanelRows } from "@/modules/fx/convert";
import { SITE_SETTINGS_DEFAULTS } from "@/modules/settings/contracts";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const ctx = await getAdminRequestContext();
  const isSuperAdmin = ctx.roles.includes("super_admin");

  const settingsRes = await getSettingsQuery({}, ctx);
  const siteSettings = settingsRes.ok ? settingsRes.data.settings : SITE_SETTINGS_DEFAULTS;
  const fx = await getFxPanelRows().catch(() => []);
  const settings = mapSiteSettingsToSettingsData(siteSettings, fx);

  const resetSiteName = isSuperAdmin ? await getSiteName() : undefined;

  return (
    <SettingsScreen
      settings={settings}
      isSuperAdmin={isSuperAdmin}
      sitePhase={siteSettings.sitePhase}
      chatbotHref="/admin/chatbot"
      auditHref="/admin/audit"
      resetSiteName={resetSiteName}
    />
  );
}
