"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Admin-host landing for the site -> admin handoff (see LoginForm). Exchanges the single-use
 * one-time token for an admin-host session cookie, then continues to `next`. Admin-class
 * access is still enforced by the (admin) layout.
 */
export default function AdminHandoffPage() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const rawNext = params.get("next") ?? "/dashboard";
    const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";
    // Keep the token out of the address bar and history as soon as it is read.
    window.history.replaceState(null, "", "/auth/handoff");
    if (!token) {
      setFailed(true);
      return;
    }
    fetch("/api/auth/one-time-token/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    })
      .then((res) => {
        if (!res.ok) throw new Error("handoff rejected");
        window.location.replace(next);
      })
      .catch(() => setFailed(true));
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-3 text-center">
        {failed ? (
          <>
            <h1 className="text-h2">Sign-in link expired</h1>
            <p className="text-body text-fg-muted">Sign in again to continue to the admin.</p>
            <Link
              href="/auth/login?next=/dashboard"
              className="text-accent-text underline underline-offset-4"
            >
              Go to sign in
            </Link>
          </>
        ) : (
          <p className="text-body text-fg-muted">Signing you in to the admin…</p>
        )}
      </div>
    </main>
  );
}
