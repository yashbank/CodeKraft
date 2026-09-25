"use client";

import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AuthCard, AuthLayout } from "./AuthLayout";
import { Banner } from "./Banner";
import { CountdownButton } from "./CountdownButton";
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
  phoneOtpEnabled = false,
  onSubmit,
}: {
  state?: RegisterState;
  sentTo?: string;
  phoneOtpEnabled?: boolean;
  onSubmit?: (values: { name: string; email: string; password: string }) => void;
}) {
  const [password, setPassword] = React.useState("");
  const loading = state === "loading";
  const rulesOk = passwordChecks(password).every((c) => c.ok);

  if (state === "sent") {
    return (
      <AuthLayout>
        <AuthCard title="Check your inbox">
          <p className="text-body text-fg-muted" aria-live="polite">
            We sent a verification link to <span className="font-medium text-fg">{sentTo}</span>. It
            expires in 24 hours.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <CountdownButton label="Resend email" initialRemaining={60} variant="secondary" />
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Back to sign in</Link>
            </Button>
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
          aria-busy={loading || undefined}
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            onSubmit?.({
              name: String(fd.get("name") ?? ""),
              email: String(fd.get("email") ?? ""),
              password,
            });
          }}
        >
          <GoogleButton disabled={loading} />
          <div className="flex items-center gap-3 text-caption text-fg-subtle">
            <Separator className="flex-1" />
            or
            <Separator className="flex-1" />
          </div>
          {state === "error" ? (
            <Banner tone="danger">
              An account with this email already exists —{" "}
              <Link href="/auth/login" className="font-medium underline">
                sign in
              </Link>{" "}
              or{" "}
              <Link href="/auth/reset" className="font-medium underline">
                reset your password
              </Link>
              .
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
              className="h-12 lg:h-10"
            />
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
              aria-invalid={state === "error" || undefined}
              className="h-12 lg:h-10"
            />
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
              minLength={10}
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
            disabled={!loading && password.length > 0 && !rulesOk}
          >
            Create account
          </Button>
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
