import type { Metadata } from "next";
import {
  ResetPasswordScreen,
  type ResetPasswordStep,
} from "@/components/account/ResetPasswordScreen";

export const metadata: Metadata = {
  title: "Reset password",
  description: "Reset your CodeKraft account password.",
};

interface PageProps {
  searchParams: Promise<{ token?: string; error?: string; step?: string; email?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: PageProps) {
  const { token, step: queryStep, email, error } = await searchParams;

  let step: ResetPasswordStep = "request";
  if (queryStep && ["request", "sent", "set", "done", "invalid"].includes(queryStep)) {
    step = queryStep as ResetPasswordStep;
  } else if (error) {
    step = "invalid";
  } else if (token) {
    step = "set";
  }

  return <ResetPasswordScreen step={step} email={email} token={token} />;
}
