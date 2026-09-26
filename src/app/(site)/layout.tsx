import { SiteShell } from "@/components/site/SiteShell";
import { SERVICE_OPTIONS } from "@/app/dev/screens/_fixtures/site";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <SiteShell
      serviceOptions={SERVICE_OPTIONS}
      themeToggleEnabled={true}
    >
      {children}
    </SiteShell>
  );
}
