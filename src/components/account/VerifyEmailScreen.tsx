"use client";

import { CircleCheckIcon, Loader2Icon, MailWarningIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { AuthCard, AuthLayout } from "./AuthLayout";
import { CountdownButton } from "./CountdownButton";
import { maskEmail } from "./format";

export type VerifyEmailState = "verifying" | "verified" | "pending" | "expired";

/**
 * SCR-AUTH-03 — verify email. Four variants: verifying (token present), verified (auto-redirect
 * countdown that can be cancelled, WCAG 2.2.1), needs verification (resend with cooldown), expired.
 */
export function VerifyEmailScreen({
  state,
  email = "you@example.com",
  signedIn = true,
  continueHref = "/account",
  redirectSeconds = 3,
  /** Renders as a card inside another page (checkout/chat interstitial) instead of the split layout. */
  embedded = false,
}: {
  state: VerifyEmailState;
  email?: string;
  signedIn?: boolean;
  continueHref?: string;
  redirectSeconds?: number;
  embedded?: boolean;
}) {
  const [countdown, setCountdown] = React.useState<number | null>(
    state === "verified" ? redirectSeconds : null,
  );
  React.useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const t = window.setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [countdown]);

  let card: React.ReactNode;
  switch (state) {
    case "verifying":
      card = (
        <AuthCard title="Verifying your email…">
          <div className="flex items-center gap-3 text-body text-fg-muted" aria-live="polite">
            <Loader2Icon aria-hidden className="size-5 animate-spin text-accent-text" />
            This only takes a moment.
          </div>
        </AuthCard>
      );
      break;
    case "verified":
      card = (
        <AuthCard title="Email verified" lede="You can now buy products and use the assistant.">
          <CircleCheckIcon aria-hidden className="size-12 text-success" />
          <div className="flex flex-wrap gap-2">
            <Button size="lg" asChild>
              <Link href={continueHref}>Continue</Link>
            </Button>
            {!signedIn ? (
              <Button size="lg" variant="secondary" asChild>
                <Link href="/auth/login">Sign in</Link>
              </Button>
            ) : null}
          </div>
          {countdown !== null && countdown > 0 ? (
            <p className="text-caption text-fg-muted" aria-live="polite">
              Taking you there in {countdown} s.{" "}
              <button
                type="button"
                className="text-accent-text underline"
                onClick={() => setCountdown(null)}
              >
                Stay on this page
              </button>
            </p>
          ) : null}
        </AuthCard>
      );
      break;
    case "expired":
      card = (
        <AuthCard title="This link has expired" lede="Verification links work for 24 hours.">
          <MailWarningIcon aria-hidden className="size-12 text-warning" />
          <div className="flex flex-wrap gap-2">
            <Button size="lg" disabled={!signedIn}>
              Send a new link
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/auth/login">Sign in</Link>
            </Button>
          </div>
          {!signedIn ? (
            <p className="text-caption text-fg-muted">Sign in first to request a new link.</p>
          ) : null}
        </AuthCard>
      );
      break;
    default:
      card = (
        <AuthCard title="Verify your email to continue">
          <p className="text-body text-fg-muted">
            We sent a link to{" "}
            <span className="font-medium text-fg">{signedIn ? email : maskEmail(email)}</span>. Open
            it to unlock purchases and the assistant.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <CountdownButton label="Resend verification email" variant="primary" size="lg" />
            <Button variant="ghost" size="lg" asChild>
              <Link href="/account/settings">Change email</Link>
            </Button>
          </div>
          <p className="text-caption text-fg-subtle">
            Didn&apos;t get it? Check spam; links expire after 24 hours.
          </p>
        </AuthCard>
      );
  }

  if (embedded) return <div className="mx-auto w-full max-w-[460px]">{card}</div>;
  return <AuthLayout>{card}</AuthLayout>;
}
