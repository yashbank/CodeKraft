"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { NOTICE_KEY, NOTICE_SEEN, shouldShowNotice } from "@/lib/cookie-consent";

/** One-time, dismissable cookie notice (no opt-in needed: essential + preference cookies only). */
export function CookieNotice() {
  const [show, setShow] = React.useState(false);
  const [height, setHeight] = React.useState(0);
  const ref = React.useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const firstPath = React.useRef(pathname);
  const cookieSeen = () => document.cookie.split("; ").includes(`${NOTICE_KEY}=${NOTICE_SEEN}`);
  const persist = React.useCallback(() => {
    try {
      localStorage.setItem(NOTICE_KEY, NOTICE_SEEN);
    } catch {
      /* private mode: dismiss for this page view only */
    }
    document.cookie = `${NOTICE_KEY}=${NOTICE_SEEN}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  React.useEffect(() => {
    try {
      setShow(shouldShowNotice(localStorage.getItem(NOTICE_KEY)) && !cookieSeen());
    } catch {
      setShow(!cookieSeen());
    }
  }, []);
  // Informational notice (no opt-in): carrying on to another page counts as having seen it.
  React.useEffect(() => {
    if (show && pathname !== firstPath.current) {
      persist();
      setShow(false);
    }
  }, [pathname, show, persist]);
  React.useEffect(() => {
    const el = ref.current;
    if (!show || !el) return;
    const sync = () => setHeight(el.offsetHeight);
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [show]);
  if (!show) return null;
  return (
    <>
      {/* In-flow spacer: reserves room under the footer so the fixed notice never covers its links. */}
      <div aria-hidden className="print:hidden" style={{ height: height + 24 }} />
      <div
        ref={ref}
        role="region"
        aria-label="Cookie notice"
        className="fixed print:hidden bottom-3 left-3 z-50 max-w-xs rounded-lg border border-border bg-surface p-3 text-caption text-fg-muted shadow-lg max-sm:right-3 max-sm:flex max-sm:max-w-none max-sm:items-center max-sm:gap-3 max-sm:py-2"
      >
        <p>
          We only use essential cookies (sign-in, theme, currency). No tracking.{" "}
          <Link href="/legal/privacy" className="text-accent-text underline">
            Privacy
          </Link>
        </p>
        <Button
          size="sm"
          variant="secondary"
          className="mt-2 max-sm:mt-0 max-sm:shrink-0"
          onClick={() => {
            persist();
            setShow(false);
          }}
        >
          Got it
        </Button>
      </div>
    </>
  );
}
