"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/modules/auth/client";
import { GoogleButton } from "./GoogleButton";
import { PasswordInput } from "./PasswordInput";

export interface LoginFormProps {
  defaultNext?: string;
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
  const next = params.get("next") ?? defaultNext;
  const [error, setError] = useState<string | null>(initialError);
  const [pending, start] = useTransition();
  const busy = pending || forceLoading;

  return (
    <form
      className="space-y-4"
      aria-busy={busy || undefined}
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          setError(null);
          const res = await authClient.signIn.email({
            email: String(fd.get("email") ?? ""),
            password: String(fd.get("password") ?? ""),
          });
          if (res.error) {
            setError(res.error.message ?? "Invalid email or password.");
            return;
          }
          router.push(next);
          router.refresh();
        });
      }}
    >
      {designed ? (
        <>
          <GoogleButton disabled={busy} />
          <div className="flex items-center gap-3 text-caption text-fg-subtle">
            <Separator className="flex-1" />
            or
            <Separator className="flex-1" />
          </div>
        </>
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
          className={designed ? "h-12 lg:h-10" : undefined}
        />
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
          />
        )}
      </div>
      {designed ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Checkbox id="remember" name="remember" disabled={busy} />
            <Label htmlFor="remember" className="font-medium">
              Remember this device
            </Label>
          </div>
          <Link href={resetHref} className="text-body-sm text-accent-text hover:underline">
            Forgot password?
          </Link>
        </div>
      ) : null}
      <Button type="submit" className="w-full" size={designed ? "lg" : "md"} loading={busy}>
        Sign in
      </Button>
      {designed ? (
        <div className="space-y-2 text-center text-body-sm text-fg-muted">
          {phoneOtpEnabled ? (
            <p>
              <Link href={otpHref} className="text-accent-text hover:underline">
                Sign in with phone instead
              </Link>
            </p>
          ) : null}
          <p>
            New to CodeKraft?{" "}
            <Link href={registerHref} className="font-medium text-accent-text hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      ) : null}
    </form>
  );
}
