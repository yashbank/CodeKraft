import type { Metadata } from "next";

import { NOINDEX } from "@/lib/seo";
import { Toaster } from "@/components/ui/sonner";

// Dynamic so Next stamps the per-request CSP nonce on these token-bearing pages (no static HTML).
export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: NOINDEX };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-app="auth">
      {children}
      {/* R8-08: resend-verification feedback toasts on /auth/register and /auth/verify. */}
      <Toaster />
    </div>
  );
}
