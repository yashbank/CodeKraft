"use client";

import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AuthCard, AuthLayout } from "./AuthLayout";
import { Banner } from "./Banner";
import { ResendVerificationButton } from "./ResendVerificationButton";
import { GoogleButton } from "./GoogleButton";
import { PasswordInput } from "./PasswordInput";
import { PasswordRules, passwordChecks } from "./PasswordRules";
import { TurnstilePlaceholder } from "./TurnstilePlaceholder";

export type RegisterState = "default" | "loading" | "error" | "turnstile" | "sent";

/**
 * SCR-AUTH-02 — create account: name, email, password with live policy hints, consent line,
 * invisible Turnstile, then the "Check your inbox" panel. Phase 7 wires `signUp.email`.
 */
export function RegisterScreen({
  state = "default",
  sentTo = "you@example.com",
  errorMessage,
  phoneOtpEnabled = false,
  continueHref = "/account",
  onSubmit,
  onGoogleClick,
}: {
  state?: RegisterState;
  sentTo?: string;
  /** "Continue" target on the account-created panel (the new customer is already signed in). */
  continueHref?: string;
  errorMessage?: React.ReactNode;
  phoneOtpEnabled?: boolean;
  onSubmit?: (values: { name: string; email: string; password: string }) => void;
  onGoogleClick?: () => void;
}) {
  const [password, setPassword] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<{ name?: string; email?: string }>({});
  const loading = state === "loading";
  const rulesOk = passwordChecks(password).every((c) => c.ok);
  const passwordInvalid = password.length > 0 && !rulesOk;

  if (state === "sent") {
    return (
      <AuthLayout>
        <AuthCard title="Account created — verify your email">
          <p className="text-body text-fg-muted" aria-live="polite">
            We sent a verification link to <span className="font-medium text-fg">{sentTo}</span>. It
            expires in 24 hours.
          </p>
          <Banner tone="info">
            You can sign in and browse right away. Purchases, payments and the assistant unlock once
            your email is verified.
          </Banner>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link href={continueHref}>Continue to your account</Link>
            </Button>
            <ResendVerificationButton
              email={sentTo}
              label="Resend email"
              initialRemaining={60}
              variant="secondary"
            />
          </div>
          <p className="text-caption text-fg-subtle">
            Didn&apos;t get it? Check spam; links expire after 24 hours.
          </p>
        </AuthCard>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <AuthCard title="Create your account">
        <form
          className="space-y-4"
          noValidate
          aria-busy={loading || undefined}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const name = String(fd.get("name") ?? "");
            const email = String(fd.get("email") ?? "");
            const next: { name?: string; email?: string } = {};
            if (!name.trim()) next.name = "Enter your full name";
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email";
            setFieldErrors(next);
            if (Object.keys(next).length > 0 || password.length === 0 || !rulesOk) return;
            onSubmit?.({ name, email, password });
          }}
        >
          <GoogleButton disabled={loading} onClick={onGoogleClick} />
          <div className="flex items-center gap-3 text-caption text-fg-subtle">
            <Separator className="flex-1" />
            or
            <Separator className="flex-1" />
          </div>
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
                      <a href={`#reg-${k}`} className="underline underline-offset-2">
                        {msg}
                      </a>
                    </li>
                  ))}
              </ul>
            </div>
          ) : null}
          {state === "error" ? (
            <Banner tone="danger">
              {errorMessage ?? "Something went wrong. Please try again."}
            </Banner>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="reg-name" required>
              Full name
            </Label>
            <Input
              id="reg-name"
              name="name"
              autoComplete="name"
              required
              disabled={loading}
              aria-invalid={fieldErrors.name ? true : undefined}
              aria-describedby={fieldErrors.name ? "reg-name-error" : undefined}
              className="h-12 lg:h-10"
            />
            {fieldErrors.name ? (
              <p id="reg-name-error" className="text-caption text-danger">
                {fieldErrors.name}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-email" required>
              Email
            </Label>
            <Input
              id="reg-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              disabled={loading}
              aria-invalid={state === "error" || fieldErrors.email ? true : undefined}
              aria-describedby={fieldErrors.email ? "reg-email-error" : undefined}
              className="h-12 lg:h-10"
            />
            {fieldErrors.email ? (
              <p id="reg-email-error" className="text-caption text-danger">
                {fieldErrors.email}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="reg-password" required>
              Password
            </Label>
            <PasswordInput
              id="reg-password"
              name="password"
              autoComplete="new-password"
              required
              minLength={12}
              disabled={loading}
              aria-describedby="reg-password-rules"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 lg:h-10"
            />
            <PasswordRules value={password} id="reg-password-rules" />
          </div>
          <TurnstilePlaceholder failed={state === "turnstile"} />
          <p className="text-caption text-fg-muted">
            By creating an account you agree to the{" "}
            <Link href="/legal/terms" className="text-accent-text hover:underline">
              Terms of service
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-accent-text hover:underline">
              Privacy policy
            </Link>
            .
          </p>
          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={loading}
            disabled={!loading && passwordInvalid}
            aria-describedby={passwordInvalid ? "reg-password-rules" : undefined}
          >
            Create account
          </Button>
          {passwordInvalid ? (
            <p className="text-center text-caption text-danger" aria-live="polite">
              Finish the password requirements above to create your account.
            </p>
          ) : null}
          <div className="space-y-2 text-center text-body-sm text-fg-muted">
            {phoneOtpEnabled ? (
              <p>
                <Link href="/auth/otp" className="text-accent-text hover:underline">
                  Sign up with phone
                </Link>
              </p>
            ) : null}
            <p>
              Already have an account?{" "}
              <Link href="/auth/login" className="font-medium text-accent-text hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
