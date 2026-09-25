"use client";

import Link from "next/link";
import * as React from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Banner } from "./Banner";
import { Field } from "./RichTextField";

export type LoginReason = "expired" | "replaced" | "forbidden" | "locked";

const REASON_COPY: Record<LoginReason, string> = {
  expired: "Signed out after 30 minutes of inactivity.",
  replaced: "Signed out because you signed in elsewhere.",
  forbidden: "This account has no admin access.",
  locked: "Too many attempts. Try again in 15 minutes.",
};

export interface AdminLoginProps {
  environment: "development" | "staging" | "production";
  /** `credentials` renders /login; `totp` renders /login/totp. */
  step?: "credentials" | "totp";
  reason?: LoginReason;
  error?: string;
  attemptsLeft?: number;
  forgotHref?: string;
  dashboardHref?: string;
}

/**
 * SCR-ADM-01 — admin login (email + password) and the TOTP step. Works at every width so the
 * read-mostly surfaces stay reachable on a phone. No Google button on the admin host.
 */
export function AdminLogin({
  environment,
  step: initialStep = "credentials",
  reason,
  error,
  attemptsLeft,
  forgotHref = "/reset",
  dashboardHref = "/dashboard",
}: AdminLoginProps) {
  const [step, setStep] = React.useState(initialStep);
  const [showPassword, setShowPassword] = React.useState(false);
  const [useBackup, setUseBackup] = React.useState(false);
  const [code, setCode] = React.useState<string[]>(["", "", "", "", "", ""]);
  const inputs = React.useRef<Array<HTMLInputElement | null>>([]);
  const h1Ref = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    h1Ref.current?.focus();
  }, [step]);

  const envTone =
    environment === "production" ? "danger" : environment === "staging" ? "warning" : "neutral";

  return (
    <main className="flex min-h-svh items-center justify-center bg-canvas px-4 py-10 text-fg">
      <Card className="w-full max-w-[400px] gap-5 py-6 tv:max-w-[480px]">
        <CardHeader className="gap-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="grid size-8 place-items-center rounded-sm bg-accent font-mono text-body-sm text-accent-fg"
            >
              CK
            </span>
            <span className="font-display text-body-lg font-semibold">
              CodeKraft <span className="text-fg-muted">Admin</span>
            </span>
            <Badge tone={envTone} dot className="ml-auto capitalize">
              {environment}
            </Badge>
          </div>
          <h1 ref={h1Ref} tabIndex={-1} className="text-h3 outline-none">
            {step === "credentials"
              ? "Sign in to CodeKraft admin"
              : "Enter your authenticator code"}
          </h1>
        </CardHeader>
        <CardContent className="space-y-4">
          {reason ? (
            <Banner
              tone={reason === "forbidden" || reason === "locked" ? "danger" : "warning"}
              role="alert"
            >
              {REASON_COPY[reason]}
            </Banner>
          ) : null}
          {error ? (
            <Banner tone="danger" role="alert">
              {error}
              {attemptsLeft !== undefined ? ` ${attemptsLeft} attempts left.` : ""}
            </Banner>
          ) : null}

          {step === "credentials" ? (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                setStep("totp");
              }}
            >
              <Field id="login-email" label="Email" required>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  required
                  aria-required
                  className="h-12"
                />
              </Field>
              <Field id="login-password" label="Password" required>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    aria-required
                    className="h-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {showPassword ? (
                      <EyeOffIcon aria-hidden className="size-4" />
                    ) : (
                      <EyeIcon aria-hidden className="size-4" />
                    )}
                  </button>
                </div>
              </Field>
              <Button type="submit" size="lg" className="w-full">
                Sign in
              </Button>
              <p className="text-center text-body-sm">
                <Link
                  href={forgotHref}
                  className="text-accent-text underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </p>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
              {useBackup ? (
                <Field
                  id="backup-code"
                  label="Backup code"
                  required
                  hint="Each backup code works once."
                >
                  <Input
                    id="backup-code"
                    required
                    aria-required
                    autoComplete="one-time-code"
                    className="h-12 font-mono"
                  />
                </Field>
              ) : (
                <fieldset className="space-y-2">
                  <legend className="text-body-sm font-semibold">6-digit code</legend>
                  <div
                    className="flex justify-between gap-2"
                    role="group"
                    aria-label="Authenticator code"
                  >
                    {code.map((digit, i) => (
                      <React.Fragment key={i}>
                        <Label htmlFor={`otp-${i}`} className="sr-only">{`Digit ${i + 1}`}</Label>
                        <Input
                          id={`otp-${i}`}
                          ref={(el) => {
                            inputs.current[i] = el;
                          }}
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={1}
                          autoComplete={i === 0 ? "one-time-code" : "off"}
                          value={digit}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(-1);
                            setCode((c) => c.map((d, j) => (j === i ? v : d)));
                            if (v && i < 5) inputs.current[i + 1]?.focus();
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Backspace" && !digit && i > 0)
                              inputs.current[i - 1]?.focus();
                          }}
                          className="h-14 w-12 text-center font-mono text-[24px] tv:h-14 tv:w-14"
                        />
                      </React.Fragment>
                    ))}
                  </div>
                  <p className="text-caption text-fg-muted" aria-live="polite">
                    {code.every((d) => d !== "")
                      ? "Verifying…"
                      : "Open your authenticator app for the current code."}
                  </p>
                </fieldset>
              )}
              <Button type="submit" size="lg" className="w-full">
                Verify
              </Button>
              <div className="flex items-center justify-between text-body-sm">
                <button
                  type="button"
                  onClick={() => setUseBackup((v) => !v)}
                  className="text-accent-text underline-offset-4 hover:underline"
                >
                  {useBackup ? "Use authenticator code" : "Use a backup code"}
                </button>
                <Link
                  href={dashboardHref}
                  className="text-fg-muted underline-offset-4 hover:underline"
                >
                  Cancel and sign out
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
