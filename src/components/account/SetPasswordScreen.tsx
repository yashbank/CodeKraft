"use client";

import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptLink, changeTemporaryPassword } from "@/modules/auth/invite-actions";
import { AuthCard, AuthLayout } from "./AuthLayout";
import { Banner } from "./Banner";
import { PasswordInput } from "./PasswordInput";
import { PasswordRules, passwordChecks } from "./PasswordRules";

export type SetPasswordMode =
  | { kind: "link"; token: string; purpose: "invite" | "reset"; email: string; needsName: boolean }
  | { kind: "change" }
  | { kind: "invalid"; reason: "invalid" | "expired" | "used" };

const INVALID_COPY = {
  invalid: "This link isn't valid. Ask your administrator for a new one.",
  expired: "This link has expired. Ask your administrator for a new one.",
  used: "This link was already used or has been replaced. Ask your administrator for a new one.",
} as const;

/** Invite / admin reset link acceptance, forced first-login password change, and the friendly dead-link page. */
export function SetPasswordScreen({ mode }: { mode: SetPasswordMode }) {
  const [current, setCurrent] = React.useState("");
  const [name, setName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);

  if (mode.kind === "invalid")
    return (
      <AuthLayout>
        <AuthCard title="Link no longer valid">
          <p className="text-body text-fg-muted">{INVALID_COPY[mode.reason]}</p>
          <Button variant="ghost" asChild>
            <Link href="/auth/login">Go to sign in</Link>
          </Button>
        </AuthCard>
      </AuthLayout>
    );

  const change = mode.kind === "change";
  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (confirm !== password || !passwordChecks(password).every((c) => c.ok)) {
      setError("Choose a password that meets every rule and matches the confirmation.");
      return;
    }
    setBusy(true);
    setError(null);
    const res =
      mode.kind === "change"
        ? await changeTemporaryPassword({ currentPassword: current, newPassword: password })
        : await acceptLink({
            token: mode.kind === "link" ? mode.token : "",
            password,
            ...(mode.kind === "link" && mode.needsName && name.trim() ? { name } : {}),
          });
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    toast.success("Password updated");
    setDone(true);
    // Full navigation: the session/flag changed server-side.
    window.location.assign(change ? "/" : "/auth/login");
  }

  return (
    <AuthLayout>
      <AuthCard
        title={
          change
            ? "Choose a new password"
            : mode.kind === "link" && mode.purpose === "invite"
              ? "Set your password"
              : "Reset your password"
        }
        lede={
          change
            ? "Your password was set by an administrator. Choose your own to continue."
            : mode.kind === "link"
              ? mode.email
              : undefined
        }
      >
        <form className="space-y-4" aria-busy={busy || undefined} onSubmit={(e) => void submit(e)}>
          {error ? <Banner tone="danger">{error}</Banner> : null}
          {change ? (
            <div className="space-y-2">
              <Label htmlFor="sp-current" required>
                Temporary password
              </Label>
              <PasswordInput
                id="sp-current"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                disabled={busy || done}
                className="h-12 lg:h-10"
              />
            </div>
          ) : null}
          {mode.kind === "link" && mode.needsName ? (
            <div className="space-y-2">
              <Label htmlFor="sp-name">Your name</Label>
              <Input
                id="sp-name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={busy || done}
                className="h-12 lg:h-10"
              />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="sp-new" required>
              New password
            </Label>
            <PasswordInput
              id="sp-new"
              autoComplete="new-password"
              required
              minLength={12}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-describedby="sp-rules"
              disabled={busy || done}
              className="h-12 lg:h-10"
            />
            <PasswordRules value={password} id="sp-rules" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sp-confirm" required>
              Confirm password
            </Label>
            <PasswordInput
              id="sp-confirm"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              aria-invalid={mismatch || undefined}
              aria-describedby={mismatch ? "sp-mismatch" : undefined}
              disabled={busy || done}
              className="h-12 lg:h-10"
            />
            {mismatch ? (
              <p id="sp-mismatch" className="text-caption text-danger">
                Passwords don&apos;t match.
              </p>
            ) : null}
          </div>
          <Button type="submit" className="w-full" size="lg" loading={busy} disabled={done}>
            Update password
          </Button>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
