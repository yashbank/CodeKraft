import type { Metadata } from "next";
import { headers } from "next/headers";

import { LoginScreen, type LoginReason } from "@/components/account/LoginScreen";
import { hostFromHeaders } from "@/modules/auth/service";

export const metadata: Metadata = {
  title: "Sign in — CodeKraft",
  description: "Sign in to access your CodeKraft products, licenses, and services.",
};

interface PageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { reason } = await searchParams;
  const host = hostFromHeaders(await headers());
  return (
    <LoginScreen
      reason={reason as LoginReason | undefined}
      host={host}
      defaultNext={host === "admin" ? "/dashboard" : "/account"}
    />
  );
}
