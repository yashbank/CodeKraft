import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { safeRedirectPath } from "@/lib/safe-redirect";

/** Redirect anonymous visitors to sign-in, returning them to the originally requested URL. */
export async function redirectToLogin(fallback: string): Promise<never> {
  const h = await headers();
  const next = safeRedirectPath(h.get("x-request-path"), fallback);
  redirect(`/auth/login?next=${encodeURIComponent(next)}`);
}
