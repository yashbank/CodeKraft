"use client";

import * as React from "react";
import { toast } from "sonner";

import type { ButtonProps } from "@/components/ui/button";
import { authClient } from "@/modules/auth/client";
import { CountdownButton } from "./CountdownButton";

/** Where the emailed link lands after Better Auth verifies the token (see /auth/verify). */
export const VERIFY_CALLBACK_URL = "/auth/verify?verified=1";

/**
 * R8-08 — a working "Resend verification email" button (the old ones were presentational).
 * Calls Better Auth `POST /api/auth/send-verification-email`; the server rate-limits it
 * (3/h, docs/09 §7) and logs any transport failure. Cooldown 60 s client-side.
 */
export function ResendVerificationButton({
  email,
  label = "Resend verification email",
  initialRemaining = 0,
  ...props
}: Omit<ButtonProps, "onClick" | "children" | "disabled"> & {
  email: string;
  label?: string;
  initialRemaining?: number;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <CountdownButton
      {...props}
      label={busy ? "Sending…" : label}
      initialRemaining={initialRemaining}
      // Only override CountdownButton's own cooldown `disabled` while a send is in flight.
      {...(busy ? { disabled: true } : {})}
      onClick={() => {
        setBusy(true);
        void authClient
          .sendVerificationEmail({ email, callbackURL: VERIFY_CALLBACK_URL })
          .then(({ error }) => {
            if (error) {
              toast.error(
                error.status === 429
                  ? "Too many requests — please wait a while before trying again."
                  : (error.message ?? "We couldn't send the email. Please try again."),
              );
            } else {
              toast.success(`Verification email sent to ${email}`);
            }
          })
          .catch(() => toast.error("We couldn't send the email. Please try again."))
          .finally(() => setBusy(false));
      }}
    />
  );
}
