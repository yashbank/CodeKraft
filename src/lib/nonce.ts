import { headers } from "next/headers";

/** Per-request CSP nonce set by middleware (dynamic routes only, docs/09 §9). */
export async function getNonce(): Promise<string | undefined> {
  const h = await headers();
  return h.get("x-nonce") ?? undefined;
}
