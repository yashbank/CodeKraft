"use client";

import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, AuthLayout } from "./AuthLayout";
import { Banner } from "./Banner";
import { CountdownButton } from "./CountdownButton";
import { maskEmail } from "./format";
import { PasswordInput } from "./PasswordInput";
import { PasswordRules } from "./PasswordRules";
import { TurnstilePlaceholder } from "./TurnstilePlaceholder";

export type ResetPasswordStep = "request" | "sent" | "set" | "done" | "invalid";

/**
 * SCR-AUTH-04 — reset password: request → sent → (token) set → done, plus invalid/expired token.
 * Never confirms whether an account exists. Phase 7 wires `forgetPassword` / `resetPassword`.
 */
export function ResetPasswordScreen({
  step,
  email = "you@example.com",
  loading = false,
  error,
}: {
  step: ResetPasswordStep;
  email?: string;
  loading?: boolean;
  error?: string | null;
}) {
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  const mismatch = touched && confirm.length > 0 && confirm !== password;

  return (
    <AuthLayout>
      {step === "request" ? (
        <AuthCard title="Reset your password" lede="Enter your email and we'll send a reset link.">
          <form
            className="space-y-4"
            aria-busy={loading || undefined}
            onSubmit={(e) => e.preventDefault()}
          >
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <div className="space-y-2">
              <Label htmlFor="reset-email" required>
                Email
              </Label>
              <Input
                id="reset-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={loading}
                className="h-12 lg:h-10"
              />
            </div>
            <TurnstilePlaceholder />
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Send reset link
            </Button>
            <p className="text-center text-body-sm">
              <Link href="/auth/login" className="text-accent-text hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        </AuthCard>
      ) : null}
      {step === "sent" ? (
        <AuthCard title="Check your inbox">
          <p className="text-body text-fg-muted" aria-live="polite">
            If an account exists for <span className="font-medium text-fg">{maskEmail(email)}</span>
            , a link is on its way. It expires in 1 hour.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <CountdownButton label="Resend" initialRemaining={60} variant="secondary" />
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Back to sign in</Link>
            </Button>
          </div>
        </AuthCard>
      ) : null}
      {step === "set" ? (
        <AuthCard title="Choose a new password">
          <form
            className="space-y-4"
            aria-busy={loading || undefined}
            onSubmit={(e) => e.preventDefault()}
          >
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <div className="space-y-2">
              <Label htmlFor="new-password" required>
                New password
              </Label>
              <PasswordInput
                id="new-password"
                name="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-describedby="new-password-rules"
                disabled={loading}
                className="h-12 lg:h-10"
              />
              <PasswordRules value={password} id="new-password-rules" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" required>
                Confirm password
              </Label>
              <PasswordInput
                id="confirm-password"
                name="confirm"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onBlur={() => setTouched(true)}
                aria-invalid={mismatch || undefined}
                aria-describedby={mismatch ? "confirm-error" : undefined}
                disabled={loading}
                className="h-12 lg:h-10"
              />
              {mismatch ? (
                <p id="confirm-error" className="text-caption text-danger">
                  Passwords don&apos;t match.
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Update password
            </Button>
            <p className="text-caption text-fg-muted">
              You&apos;ll be signed out of other devices.
            </p>
          </form>
        </AuthCard>
      ) : null}
      {step === "done" ? (
        <AuthCard title="Password updated" lede="Use your new password to sign in.">
          <Button size="lg" asChild>
            <Link href="/auth/login">Sign in</Link>
          </Button>
        </AuthCard>
      ) : null}
      {step === "invalid" ? (
        <AuthCard
          title="This link is no longer valid"
          lede="Reset links work once and expire after 1 hour."
        >
          <Button size="lg" asChild>
            <Link href="/auth/reset">Request a new link</Link>
          </Button>
        </AuthCard>
      ) : null}
    </AuthLayout>
  );
}
