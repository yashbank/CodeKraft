import { Toaster } from "@/components/ui/sonner";
import { SiteShell } from "@/components/site/SiteShell";
import { SERVICE_OPTIONS } from "@/app/dev/screens/_fixtures/site";
import { getThemeConfig } from "@/lib/site-brand";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const { themeToggle } = await getThemeConfig();
  return (
    <SiteShell serviceOptions={SERVICE_OPTIONS} themeToggleEnabled={themeToggle}>
      {children}
      <Toaster />
    </SiteShell>
  );
}
