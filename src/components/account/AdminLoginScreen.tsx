"use client";

import Link from "next/link";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthCard, AuthLayout } from "./AuthLayout";
import { Banner } from "./Banner";
import { OtpInput } from "./OtpInput";
import { PasswordInput } from "./PasswordInput";
import { Wordmark } from "./Wordmark";

/**
 * Admin-host login (SCR-ADM-01, referenced by SCR-AUTH-01): credentials then a TOTP step, no Google.
 * Presentational — Phase 7 wires `signIn.email` + the two-factor client. `step` drives the preview.
 */
export function AdminLoginScreen({
  step = "credentials",
  environment = "Staging",
  error,
  loading = false,
  onSubmitCredentials,
  onVerify,
}: {
  step?: "credentials" | "totp";
  environment?: "Staging" | "Production";
  error?: string | null;
  loading?: boolean;
  onSubmitCredentials?: (email: string, password: string) => void;
  onVerify?: (code: string) => void;
}) {
  const [code, setCode] = React.useState("");
  const [backup, setBackup] = React.useState(false);

  return (
    <AuthLayout variant="admin">
      <div className="mb-6 flex items-center justify-between">
        <Wordmark tag="Admin" />
        <Badge tone={environment === "Production" ? "danger" : "warning"}>{environment}</Badge>
      </div>
      {step === "credentials" ? (
        <AuthCard title="Sign in to CodeKraft admin">
          <form
            className="space-y-4"
            aria-busy={loading || undefined}
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              onSubmitCredentials?.(
                String(fd.get("email") ?? ""),
                String(fd.get("password") ?? ""),
              );
            }}
          >
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input
                id="admin-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <PasswordInput
                id="admin-password"
                name="password"
                autoComplete="current-password"
                required
                disabled={loading}
              />
            </div>
            <Button type="submit" className="w-full" loading={loading}>
              Sign in
            </Button>
            <p className="text-center text-body-sm">
              <Link href="/auth/reset" className="text-accent-text hover:underline">
                Forgot password?
              </Link>
            </p>
          </form>
        </AuthCard>
      ) : (
        <AuthCard
          title="Enter your authenticator code"
          lede="Open your authenticator app and enter the 6-digit code for CodeKraft admin."
        >
          <form
            className="space-y-5"
            aria-busy={loading || undefined}
            onSubmit={(e) => {
              e.preventDefault();
              onVerify?.(code);
            }}
          >
            {error ? <Banner tone="danger">{error}</Banner> : null}
            {backup ? (
              <div className="space-y-2">
                <Label htmlFor="backup-code">Backup code</Label>
                <Input
                  id="backup-code"
                  name="backup"
                  autoComplete="off"
                  className="font-mono"
                  disabled={loading}
                />
              </div>
            ) : (
              <OtpInput value={code} onChange={setCode} disabled={loading} invalid={!!error} />
            )}
            <button
              type="button"
              className="text-body-sm text-accent-text hover:underline"
              onClick={() => setBackup((b) => !b)}
            >
              {backup ? "Use the authenticator app" : "Use a backup code"}
            </button>
            <Button type="submit" className="w-full" loading={loading}>
              Verify
            </Button>
            <p className="text-center text-body-sm">
              <Link href="/auth/login" className="text-fg-muted hover:text-fg hover:underline">
                Cancel and sign out
              </Link>
            </p>
          </form>
        </AuthCard>
      )}
    </AuthLayout>
  );
}
