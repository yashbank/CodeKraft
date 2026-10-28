"use client";

import { SiteLogo } from "@/components/brand/site-brand";

/** Public-site brand mark: the admin-uploaded logo, else the site name as text (Settings → General). */
export function Wordmark({ className }: { className?: string; title?: string }) {
  return <SiteLogo className={className} />;
}
