import { Suspense } from "react";

import { AuthCard, AuthLayout } from "./AuthLayout";
import { Banner, type BannerTone } from "./Banner";
import { LoginForm, type LoginFormProps } from "./LoginForm";

export type LoginReason = "suspended" | "replaced" | "expired" | "verify";

export const LOGIN_REASON_COPY: Record<LoginReason, { tone: BannerTone; text: string }> = {
  suspended: {
    tone: "danger",
    text: "This account is suspended. Sign in to another account or open a query.",
  },
  replaced: {
    tone: "info",
    text: "You were signed out because you signed in on another device.",
  },
  expired: { tone: "info", text: "Your session timed out after 60 minutes of inactivity." },
  verify: { tone: "warning", text: "Verify your email to continue — check your inbox." },
};

/** SCR-AUTH-01 — customer login inside the auth split layout. */
export function LoginScreen({
  reason,
  tagline,
  ...form
}: LoginFormProps & { reason?: LoginReason; tagline?: string }) {
  const banner = reason ? LOGIN_REASON_COPY[reason] : null;
  return (
    <AuthLayout tagline={tagline}>
      <AuthCard title="Sign in">
        {banner ? <Banner tone={banner.tone}>{banner.text}</Banner> : null}
        <Suspense fallback={null}>
          <LoginForm designed {...form} />
        </Suspense>
      </AuthCard>
    </AuthLayout>
  );
}
