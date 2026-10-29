import type { Metadata } from "next";

import { NOINDEX } from "@/lib/seo";
import { Toaster } from "@/components/ui/sonner";
import { enforcePasswordChange } from "@/lib/authz/must-change";
import { redirectToLogin } from "@/lib/authz/login-redirect";

import { getSession } from "@/modules/auth/service";

export const dynamic = "force-dynamic";

/** Customer area: session required (BR-03). Full dashboard shell lands in P7. */
export const metadata: Metadata = { robots: NOINDEX };

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) return redirectToLogin("/account");
  enforcePasswordChange(session);
  return (
    <div data-app="account">
      {children}
      <Toaster />
    </div>
  );
}
