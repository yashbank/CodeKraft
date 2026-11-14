import { Toaster } from "@/components/ui/sonner";
import { SiteShell } from "@/components/site/SiteShell";
import { SitePhaseBanner } from "@/components/site/SitePhaseBanner";
import { getSiteContact, getThemeConfig } from "@/lib/site-brand";
import { getEnabledCurrencies } from "@/lib/display-currency";
import { SERVICE_OPTIONS } from "@/app/dev/screens/_fixtures/site";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ themeToggle }, contact, display] = await Promise.all([
    getThemeConfig(),
    getSiteContact(),
    getEnabledCurrencies(),
  ]);
  return (
    <>
      <SitePhaseBanner />
      <SiteShell
        serviceOptions={SERVICE_OPTIONS}
        themeToggleEnabled={themeToggle}
        contact={contact}
        currency={display.base}
        currencyOptions={display.enabled}
      >
        {children}
        <Toaster />
      </SiteShell>
    </>
  );
}
