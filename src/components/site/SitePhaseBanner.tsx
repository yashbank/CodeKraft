"use client";

import * as React from "react";

/**
 * Slim "Test site" strip shown on the public storefront while the site phase is `testing`.
 * Client-side on purpose: price pages are ISR twins cached for minutes, so the phase is never baked
 * into cached HTML. The middleware already knows the phase and mirrors it into a short-lived
 * `ck_phase` cookie, which is read here after hydration: no extra request per page view, and
 * nothing renders (or is set) on a live site.
 */
export function SitePhaseBanner() {
  const [testing, setTesting] = React.useState(false);
  React.useEffect(() => {
    setTesting(/(?:^|;\s*)ck_phase=testing(?:;|$)/.test(document.cookie));
  }, []);
  if (!testing) return null;
  return (
    <div
      role="status"
      data-testid="site-test-banner"
      className="bg-warning-soft px-4 py-1 text-center text-caption font-medium text-warning"
    >
      Test site &mdash; orders and emails here are not real.
    </div>
  );
}
