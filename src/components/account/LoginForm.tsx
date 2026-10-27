"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { authClient } from "@/modules/auth/client";
import { GoogleButton } from "./GoogleButton";
import { PasswordInput } from "./PasswordInput";
import { SiteName } from "@/components/brand/site-brand";

export interface LoginFormProps {
  defaultNext?: string;
  /** Which Better Auth host this form is rendered on (docs/09 §3.4). Defaults to "site" so
   * existing previews/tests that don't pass it keep the customer behaviour. */
  host?: "site" | "admin";
  /** SCR-AUTH-01 visuals: Google button + divider, "Remember this device", "Forgot password?". */
  designed?: boolean;
  /** Shown as the initial inline error (preview of the error state). */
  initialError?: string | null;
  /** Renders the form disabled with a spinner (preview of the loading state). */
  forceLoading?: boolean;
  /** "Sign in with phone instead" link, only when the `phone_otp` flag is on. */
  phoneOtpEnabled?: boolean;
  registerHref?: string;
  resetHref?: string;
  otpHref?: string;
}

/**
 * Working sign-in (P1.7 gate) with the SCR-AUTH-01 visuals behind `designed`. Behaviour and the
 * "Email"/"Password" labels are unchanged: submit calls Better Auth `signIn.email`, then routes to
 * `?next=` or `defaultNext`. Google sign-in is wired in Phase 7 (`signIn.social`).
 */
export function LoginForm({
  defaultNext = "/account",
  host = "site",
  designed = false,
  initialError = null,
  forceLoading = false,
  phoneOtpEnabled = false,
  registerHref = "/auth/register",
  resetHref = "/auth/reset",
  otpHref = "/auth/otp",
}: LoginFormProps) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeRedirectPath(params.get("next") ?? params.get("returnTo"), defaultNext);
  const [error, setError] = useState<string | null>(initialError);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [pending, start] = useTransition();
  const busy = pending || forceLoading;
  // Before hydration a click would post natively and drop the typed credentials.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  return (
    <form
      className="space-y-4"
      method="post"
      noValidate
      aria-busy={busy || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get("email") ?? "");
        const password = String(fd.get("password") ?? "");
        const nextFieldErrors: { email?: string; password?: string } = {};
        if (!email.trim()) nextFieldErrors.email = "Enter your email";
        if (!password) nextFieldErrors.password = "Enter your password";
        setFieldErrors(nextFieldErrors);
        if (Object.keys(nextFieldErrors).length > 0) return;
        start(async () => {
          setError(null);
          const res = await authClient.signIn.email({ email, password });
          if (res.error) {
            setError(res.error.message ?? "Invalid email or password.");
            return;
          }
          // Admin/super_admin accounts signing in on the public site still only get a
          // customer ("ck") session — the admin subdomain issues its own ("ckadm") session
          // (docs/09 §3.4). Hand them to the admin sign-in instead of dropping them at /account.
          if (host === "site") {
            try {
              const roleRes = await fetch("/api/auth/role", { cache: "no-store" });
              const { isAdminClass } = (await roleRes.json()) as { isAdminClass?: boolean };
              if (isAdminClass) {
                // Hand the existing session across hosts with a one-time token instead of
                // making the admin re-enter credentials on the admin host.
                const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL ?? "";
                const tokenRes = await fetch("/api/auth/one-time-token/generate", {
                  cache: "no-store",
                });
                const { token } = (await tokenRes.json()) as { token?: string };
                if (token) {
                  window.location.href = `${adminUrl}/auth/handoff?token=${encodeURIComponent(token)}&next=/dashboard`;
                  return;
                }
                window.location.href = `${adminUrl}/auth/login?next=/dashboard`;
                return;
              }
            } catch {
              // Role lookup failing shouldn't block a normal customer sign-in.
            }
          }
          router.push(next);
          router.refresh();
        });
      }}
    >
      {designed && host !== "admin" ? (
        <>
          <GoogleButton
            disabled={busy}
            onClick={() => {
              void authClient.signIn.social({ provider: "google", callbackURL: next });
            }}
          />
          <div className="flex items-center gap-3 text-caption text-fg-subtle">
            <Separator className="flex-1" />
            or
            <Separator className="flex-1" />
          </div>
        </>
      ) : null}
      {Object.entries(fieldErrors).filter(([, v]) => Boolean(v)).length > 0 ? (
        <div
          role="alert"
          className="rounded-md border-l-4 border-danger bg-danger-soft px-4 py-3 text-body-sm text-danger"
        >
          <p className="font-semibold">Please fix the following:</p>
          <ul className="mt-1 list-disc pl-5">
            {Object.entries(fieldErrors)
              .filter(([, v]) => Boolean(v))
              .map(([k, msg]) => (
                <li key={k}>
                  <a href={`#${k}`} className="underline underline-offset-2">
                    {msg}
                  </a>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-md border-l-4 border-danger bg-danger-soft px-3 py-2 text-body-sm text-danger"
        >
          {error}
        </p>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={busy}
          aria-invalid={fieldErrors.email ? true : undefined}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          className={designed ? "h-12 lg:h-10" : undefined}
        />
        {fieldErrors.email ? (
          <p id="email-error" className="text-caption text-danger">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        {designed ? (
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            disabled={busy}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            className="h-12 lg:h-10"
          />
        ) : (
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={busy}
            aria-invalid={fieldErrors.password ? true : undefined}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
          />
        )}
        {fieldErrors.password ? (
          <p id="password-error" className="text-caption text-danger">
            {fieldErrors.password}
          </p>
        ) : null}
      </div>
      {designed ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {host !== "admin" ? (
            <label htmlFor="remember" className="flex min-h-11 items-center gap-2 sm:min-h-0">
              <Checkbox
                id="remember"
                name="remember"
                disabled={busy}
                className="relative max-sm:after:absolute max-sm:after:-inset-2.5 max-sm:after:content-['']"
              />
              <span className="font-medium text-body-sm">Remember this device</span>
            </label>
          ) : null}
          <Link href={resetHref} className="text-body-sm text-accent-text hover:underline">
            Forgot password?
          </Link>
        </div>
      ) : null}
      <Button
        type="submit"
        disabled={!hydrated}
        className="w-full"
        size={designed ? "lg" : "md"}
        loading={busy}
      >
        Sign in
      </Button>
      {designed && host !== "admin" ? (
        <div className="space-y-2 text-center text-body-sm text-fg-muted">
          {phoneOtpEnabled ? (
            <p>
              <Link href={otpHref} className="text-accent-text hover:underline">
                Sign in with phone instead
              </Link>
            </p>
          ) : null}
          <p>
            New to <SiteName />?{" "}
            <Link href={registerHref} className="font-medium text-accent-text hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      ) : null}
    </form>
  );
}
