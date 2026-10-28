"use client";

import * as React from "react";

import { cn } from "@/components/ui/_utils";
import { DEFAULT_SITE_NAME } from "@/lib/brand-constants";

const SiteNameContext = React.createContext<string>(DEFAULT_SITE_NAME);
const SiteLogoContext = React.createContext<string | null>(null);

/**
 * R8-11 — carries the admin-editable "Site name" (Settings → General, `site_settings.site_name`)
 * from the root layout down to client chrome (site header/footer, account + admin shells).
 */
export function SiteBrandProvider({
  siteName,
  siteLogo = null,
  children,
}: {
  siteName: string;
  siteLogo?: string | null;
  children: React.ReactNode;
}) {
  return (
    <SiteNameContext.Provider value={siteName}>
      <SiteLogoContext.Provider value={siteLogo}>{children}</SiteLogoContext.Provider>
    </SiteNameContext.Provider>
  );
}

export function useSiteLogo(): string | null {
  return React.useContext(SiteLogoContext);
}

/**
 * The one brand mark: the uploaded site logo, else a neutral text wordmark of the site name.
 * `className` sizes the image (height); text uses the surrounding font.
 */
export function SiteLogo({ className }: { className?: string }) {
  const logo = useSiteLogo();
  const name = useSiteName();
  // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded URL, arbitrary dimensions
  if (logo) return <img src={logo} alt={name} className={cn("h-6 w-auto", className)} />;
  return (
    <span
      className={cn(
        "inline-flex items-center font-display text-h4 leading-none font-semibold tracking-tight whitespace-nowrap",
        className,
      )}
    >
      {name}
    </span>
  );
}

export function useSiteName(): string {
  return React.useContext(SiteNameContext);
}

/** Inline text of the configured site name — usable from server components too. */
export function SiteName({ prefix = "", suffix = "" }: { prefix?: string; suffix?: string }) {
  return (
    <>
      {prefix}
      {useSiteName()}
      {suffix}
    </>
  );
}
