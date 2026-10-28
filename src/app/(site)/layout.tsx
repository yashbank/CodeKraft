import { Toaster } from "@/components/ui/sonner";
import { SiteShell } from "@/components/site/SiteShell";
import { getSiteContact, getThemeConfig } from "@/lib/site-brand";
import { SERVICE_OPTIONS } from "@/app/dev/screens/_fixtures/site";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [{ themeToggle }, contact] = await Promise.all([getThemeConfig(), getSiteContact()]);
  return (
    <SiteShell serviceOptions={SERVICE_OPTIONS} themeToggleEnabled={themeToggle} contact={contact}>
      {children}
      <Toaster />
    </SiteShell>
  );
}
