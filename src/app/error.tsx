"use client";

import { useEffect } from "react";

import { ErrorPanel } from "@/components/site/ErrorPanel";

/** Site-wide 500 boundary: branded, no stack trace - only the opaque digest for support. */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry capture is wired in P1.8 (instrumentation); keep console for local.
    console.error(error);
  }, [error]);
  return (
    <ErrorPanel
      code="500"
      title="Something went wrong"
      body="An unexpected error stopped this page from loading. It has been logged. Try again, or head somewhere else."
      digest={error.digest}
      onRetry={reset}
      searchAction="/products"
      links={[
        { href: "/", label: "Go home" },
        { href: "/contact", label: "Contact us" },
      ]}
    />
  );
}
