import type { Metadata } from "next";

import { LoginScreen, type LoginReason } from "@/components/account/LoginScreen";

export const metadata: Metadata = {
  title: "Sign in — CodeKraft",
  description: "Sign in to access your CodeKraft products, licenses, and services.",
};

interface PageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { reason } = await searchParams;
  return <LoginScreen reason={reason as LoginReason | undefined} />;
}
