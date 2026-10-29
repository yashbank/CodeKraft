/**
 * Cache-Control rules for next.config `headers()` (P15-02). Kept in a plain module so a unit test
 * can assert them. Pages carry their own ISR headers (`revalidate`); `/_next/static` is already
 * immutable (hashed). `/api/files/**` is owned by P15-01 and set in the route handlers.
 */
export interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

const cc = (source: string, value: string): HeaderRule => ({
  source,
  headers: [{ key: "Cache-Control", value }],
});

/** Unhashed files in /public: a day at the edge/browser, a week stale-while-revalidate. */
const PUBLIC_ASSET = "public, max-age=86400, stale-while-revalidate=604800";
/** Authenticated or per-user JSON: never stored by a shared cache. */
const PRIVATE = "private, no-store";

export const cacheHeaderRules: HeaderRule[] = [
  cc("/brand/:path*", PUBLIC_ASSET),
  cc("/images/:path*", PUBLIC_ASSET),
  cc("/noise.png", PUBLIC_ASSET),
  // Host-dependent but Vercel keys its cache by host; the body changes only on a deploy.
  cc("/robots.txt", "public, s-maxage=3600, stale-while-revalidate=86400"),
  cc("/api/notifications", PRIVATE),
  cc("/api/admin/:path*", PRIVATE),
  cc("/api/auth/:path*", PRIVATE),
  cc("/api/chat", PRIVATE),
  cc("/api/leads", PRIVATE),
];
