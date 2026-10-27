"use client";

import * as React from "react";

import { DEFAULT_SITE_NAME } from "@/lib/brand-constants";

const SiteNameContext = React.createContext<string>(DEFAULT_SITE_NAME);

/**
 * R8-11 — carries the admin-editable "Site name" (Settings → General, `site_settings.site_name`)
 * from the root layout down to client chrome (site header/footer, account + admin shells).
 */
export function SiteBrandProvider({
  siteName,
  children,
}: {
  siteName: string;
  children: React.ReactNode;
}) {
  return <SiteNameContext.Provider value={siteName}>{children}</SiteNameContext.Provider>;
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
