import { Toaster } from "@/components/ui/sonner";
import { redirectToLogin } from "@/lib/authz/login-redirect";

import { getSession } from "@/modules/auth/service";

export const dynamic = "force-dynamic";

/** Customer area: session required (BR-03). Full dashboard shell lands in P7. */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) return redirectToLogin("/account");
  return (
    <div data-app="account">
      {children}
      <Toaster />
    </div>
  );
}
