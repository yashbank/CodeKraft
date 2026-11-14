"use client";

import * as React from "react";

/**
 * Slim "Test site" strip shown on the public storefront while the site phase is `testing`.
 * Client-side on purpose: price pages are ISR twins cached for minutes, so the phase is fetched
 * (no-store) after hydration instead of being baked into cached HTML. Renders nothing when live.
 */
export function SitePhaseBanner() {
  const [testing, setTesting] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/site-phase", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((body: { phase?: string } | null) => {
        if (!cancelled) setTesting(body?.phase === "testing");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
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
