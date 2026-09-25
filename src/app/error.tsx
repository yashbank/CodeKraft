"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
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
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="space-y-3 text-center">
        <h1 className="text-h2">Something went wrong</h1>
        {error.digest ? (
          <p className="text-body-sm text-fg-muted">Reference: {error.digest}</p>
        ) : null}
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  );
}
