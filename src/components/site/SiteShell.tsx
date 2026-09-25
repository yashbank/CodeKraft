import type { ReactNode } from "react";

import { SiteFooter } from "./SiteFooter";
import { SiteHeader, type SiteHeaderProps } from "./SiteHeader";

/**
 * Public-site page frame: skip link + header + `<main id="main">` + footer. The `(site)` layout
 * renders this in P7; previews render it per page with fixture service options.
 */
export function SiteShell({
  children,
  themeToggleEnabled = false,
  ...header
}: SiteHeaderProps & { children: ReactNode }) {
  return (
    <div data-app="site" className="flex min-h-screen flex-col bg-canvas text-fg">
      <SiteHeader {...header} themeToggleEnabled={themeToggleEnabled} />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter themeToggleEnabled={themeToggleEnabled} />
    </div>
  );
}
