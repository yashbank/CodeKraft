"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, AuthLayout } from "./AuthLayout";
import { Banner } from "./Banner";
import { CountdownButton } from "./CountdownButton";
import { authClient } from "@/modules/auth/client";
import { maskEmail } from "./format";
import { PasswordInput } from "./PasswordInput";
import { PasswordRules, passwordChecks } from "./PasswordRules";
import { TurnstilePlaceholder } from "./TurnstilePlaceholder";

export type ResetPasswordStep = "request" | "sent" | "set" | "done" | "invalid";

/**
 * SCR-AUTH-04 — reset password: request → sent → (token) set → done, plus invalid/expired token.
 * Never confirms whether an account exists. Phase 7 wires `forgetPassword` / `resetPassword`.
 */
export function ResetPasswordScreen({
  step: stepProp,
  email: emailProp = "you@example.com",
  loading: loadingProp = false,
  error: errorProp,
  token,
}: {
  step: ResetPasswordStep;
  email?: string;
  loading?: boolean;
  error?: string | null;
  /** Reset token from the emailed link (`?token=`). */
  token?: string;
}) {
  const router = useRouter();
  const [sentEmail, setSentEmail] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [requestError, setRequestError] = React.useState<string | null>(null);
  const step = sentEmail !== null && stepProp === "request" ? "sent" : stepProp;
  const email = sentEmail ?? emailProp;
  const loading = loadingProp || submitting;
  const error = requestError ?? errorProp;
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [touched, setTouched] = React.useState(false);
  async function requestReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!value) return;
    setSubmitting(true);
    setRequestError(null);
    try {
      // Better Auth answers identically whether or not the account exists (no enumeration).
      const res = await authClient.requestPasswordReset({
        email: value,
        redirectTo: "/auth/reset",
      });
      if (res.error) {
        setRequestError("We couldn't send the reset link. Please try again in a moment.");
      } else {
        setSentEmail(value);
      }
    } catch {
      setRequestError("We couldn't send the reset link. Please try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  async function setNewPassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    if (!token || confirm !== password || !passwordChecks(password).every((c) => c.ok)) return;
    setSubmitting(true);
    setRequestError(null);
    try {
      const res = await authClient.resetPassword({ newPassword: password, token });
      if (res.error) {
        setRequestError(res.error.message ?? "We couldn't update your password. Please try again.");
      } else {
        toast.success("Password updated. Sign in with your new password.");
        router.push("/auth/login");
      }
    } catch {
      setRequestError("We couldn't update your password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const mismatch = touched && confirm.length > 0 && confirm !== password;

  return (
    <AuthLayout>
      {step === "request" ? (
        <AuthCard title="Reset your password" lede="Enter your email and we'll send a reset link.">
          <form
            className="space-y-4"
            aria-busy={loading || undefined}
            onSubmit={(e) => void requestReset(e)}
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
            onSubmit={(e) => void setNewPassword(e)}
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
                minLength={12}
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
