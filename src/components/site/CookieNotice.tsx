"use client";

import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { NOTICE_KEY, NOTICE_SEEN, shouldShowNotice } from "@/lib/cookie-consent";

/** One-time, dismissable cookie notice (no opt-in needed: essential + preference cookies only). */
export function CookieNotice() {
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    try {
      setShow(shouldShowNotice(localStorage.getItem(NOTICE_KEY)));
    } catch {
      setShow(false);
    }
  }, []);
  if (!show) return null;
  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed print:hidden bottom-3 left-3 z-50 max-w-xs rounded-lg border border-border bg-surface p-3 text-caption text-fg-muted shadow-lg max-sm:right-3 max-sm:max-w-none"
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
        className="mt-2"
        onClick={() => {
          try {
            localStorage.setItem(NOTICE_KEY, NOTICE_SEEN);
          } catch {
            /* private mode: dismiss for this page view only */
          }
          setShow(false);
        }}
      >
        Got it
      </Button>
    </div>
  );
}
