/** Server-side auth helpers used by layouts, actions and middleware (P1.6 buildContext consumes these). */
import { cache } from "react";
import { headers as nextHeaders } from "next/headers";

import { getEnv } from "@/lib/env";
import { getAuth } from "./config";
import type { AuthHost } from "./hooks";

export type { AuthHost };

export function hostFromHeaders(h: Headers): AuthHost {
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  return host === getEnv().ADMIN_HOST ? "admin" : "site";
}

/**
 * Memoized per request (React cache): the admin layout, the page, and the action wrappers each
 * ask for the session on the same request, and each ask was a DB round trip. The cache scope is
 * one server request, so nothing is shared between users.
 */
export const getSession = cache(async (h?: Headers) => {
  const hdrs = h ?? (await nextHeaders());
  const auth = await getAuth(hostFromHeaders(hdrs));
  return auth.api.getSession({ headers: hdrs });
});

export async function signOut(h?: Headers) {
  const hdrs = h ?? (await nextHeaders());
  const auth = await getAuth(hostFromHeaders(hdrs));
  return auth.api.signOut({ headers: hdrs });
}
