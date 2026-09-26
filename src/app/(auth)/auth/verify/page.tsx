import type { Metadata } from "next";
import { VerifyEmailScreen, type VerifyEmailState } from "@/components/account/VerifyEmailScreen";

export const metadata: Metadata = {
  title: "Verify your email — CodeKraft",
  description: "Verify your email address to activate your account and access software purchases.",
};

interface PageProps {
  searchParams: Promise<{ token?: string; error?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: PageProps) {
  const { token, error } = await searchParams;

  const state: VerifyEmailState = error
    ? "expired"
    : token
    ? "verified"
    : "pending";

  return <VerifyEmailScreen state={state} />;
}
