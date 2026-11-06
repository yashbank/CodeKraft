import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getEnv } from "@/lib/env";
import { postLoginDestination } from "@/lib/authz/post-login";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { getAuth } from "@/modules/auth/config";
import { loadRoles } from "@/modules/auth/roles-port";
import { getSession } from "@/modules/auth/service";

export const dynamic = "force-dynamic";

/**
 * Where every social / magic-link sign-in lands (Google's callbackURL points here). Asks the
 * shared `postLoginDestination` rule where the user belongs: admin-class users are handed to the
 * admin host with a one-time token, customers continue to the page they asked for.
 */
export default async function PostLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await getSession();
  if (!session) redirect("/auth/login");

  const dest = postLoginDestination(
    await loadRoles(session.user.id),
    safeRedirectPath(next, "/account"),
  );
  if (dest.area === "customer") redirect(dest.path);

  const adminUrl = getEnv().NEXT_PUBLIC_ADMIN_URL;
  const h = await headers();
  const token = await (
    await getAuth("site")
  ).api
    .generateOneTimeToken({ headers: h })
    .then((r) => r.token)
    .catch(() => null);
  if (!token) redirect(`${adminUrl}/auth/login?next=${encodeURIComponent(dest.path)}`);
  redirect(
    `${adminUrl}/auth/handoff?token=${encodeURIComponent(token)}&next=${encodeURIComponent(dest.path)}`,
  );
}
