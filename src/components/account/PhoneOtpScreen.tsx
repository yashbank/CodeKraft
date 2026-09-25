"use client";

import { PhoneOffIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuthCard, AuthLayout } from "./AuthLayout";
import { Banner } from "./Banner";
import { CountdownButton } from "./CountdownButton";
import { EmptyState } from "./EmptyState";
import { maskPhone } from "./format";
import { OtpInput } from "./OtpInput";
import { TurnstilePlaceholder } from "./TurnstilePlaceholder";

export type PhoneOtpStep = "phone" | "code" | "email";

const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "US / Canada (+1)" },
  { code: "+44", label: "United Kingdom (+44)" },
  { code: "+971", label: "UAE (+971)" },
];

/**
 * SCR-AUTH-05 — phone OTP sign-in behind the `phone_otp` flag. Flag off: the route 404s; the
 * preview shows the notice. Flag on: phone → code → (first login) email.
 */
export function PhoneOtpScreen({
  enabled,
  step = "phone",
  phone = "+919876543242",
  error,
  attemptsLeft,
  loading = false,
}: {
  enabled: boolean;
  step?: PhoneOtpStep;
  phone?: string;
  error?: string | null;
  attemptsLeft?: number;
  loading?: boolean;
}) {
  const [code, setCode] = React.useState("");

  if (!enabled) {
    return (
      <AuthLayout>
        <EmptyState
          icon={PhoneOffIcon}
          title="Phone sign-in isn't available"
          body="This page returns 404 while the phone_otp feature flag is off; entry links are hidden. Turn the flag on in Settings once an SMS provider is configured."
          action={
            <Button asChild>
              <Link href="/auth/login">Sign in with email</Link>
            </Button>
          }
          className="bg-surface"
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      {step === "phone" ? (
        <AuthCard title="Sign in with your phone">
          <form
            className="space-y-4"
            aria-busy={loading || undefined}
            onSubmit={(e) => e.preventDefault()}
          >
            {error ? <Banner tone="danger">{error}</Banner> : null}
            <div className="space-y-2">
              <Label htmlFor="otp-phone" required>
                Phone number
              </Label>
              <div className="flex gap-2">
                <Select defaultValue="+91">
                  <SelectTrigger aria-label="Country code" className="w-36 shrink-0 h-12 lg:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CODES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="otp-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel-national"
                  required
                  disabled={loading}
                  className="h-12 lg:h-10"
                />
              </div>
            </div>
            <TurnstilePlaceholder />
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Send code
            </Button>
            <p className="text-center text-body-sm">
              <Link href="/auth/login" className="text-accent-text hover:underline">
                Use email instead
              </Link>
            </p>
          </form>
        </AuthCard>
      ) : null}
      {step === "code" ? (
        <AuthCard title="Enter the 6-digit code" lede={`Sent to ${maskPhone(phone)}`}>
          <form
            className="space-y-5"
            aria-busy={loading || undefined}
            onSubmit={(e) => e.preventDefault()}
          >
            {error ? (
              <Banner tone="danger">
                {error}
                {attemptsLeft !== undefined ? ` — ${attemptsLeft} attempts left.` : null}
              </Banner>
            ) : null}
            <OtpInput value={code} onChange={setCode} disabled={loading} invalid={!!error} />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button type="submit" size="lg" className="w-full sm:w-auto" loading={loading}>
                Verify
              </Button>
              <CountdownButton
                label="Resend code"
                seconds={30}
                initialRemaining={30}
                className="w-full sm:w-auto"
              />
            </div>
            <p className="text-center text-body-sm">
              <Link href="/auth/otp" className="text-accent-text hover:underline">
                Change number
              </Link>
            </p>
          </form>
        </AuthCard>
      ) : null}
      {step === "email" ? (
        <AuthCard
          title="Add your email"
          lede="We send receipts, invoices and download links by email."
        >
          <form
            className="space-y-4"
            aria-busy={loading || undefined}
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="space-y-2">
              <Label htmlFor="otp-email" required>
                Email
              </Label>
              <Input
                id="otp-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={loading}
                className="h-12 lg:h-10"
              />
            </div>
            <Button type="submit" className="w-full" size="lg" loading={loading}>
              Continue
            </Button>
            <p className="text-caption text-fg-muted">
              Your phone is verified. Your email stays unverified until you open the link we send.
            </p>
          </form>
        </AuthCard>
      ) : null}
    </AuthLayout>
  );
}
