import type { Metadata } from "next";
import { VerifyEmailScreen, type VerifyEmailState } from "@/components/account/VerifyEmailScreen";
import { getSession } from "@/modules/auth/service";

export const metadata: Metadata = {
  title: "Verify your email",
  description: "Verify your email address to activate your account and access software purchases.",
};

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ token?: string; error?: string; verified?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { token, error, verified } = await searchParams;
  const session = await getSession();

  // Better Auth redirects the emailed link to `callbackURL` (`?verified=1`) on success and to
  // `callbackURL&error=...` on an expired/invalid token. A signed-in user whose email is already
  // verified also sees the success state.
  const state: VerifyEmailState = error
    ? "expired"
    : token || verified || session?.user.emailVerified
      ? "verified"
      : "pending";

  return (
    <VerifyEmailScreen
      state={state}
      signedIn={Boolean(session)}
      {...(session?.user.email ? { email: session.user.email } : {})}
    />
  );
}
