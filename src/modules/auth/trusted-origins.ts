/**
 * Origins Better Auth accepts for state-changing requests (CSRF origin check).
 * The `*.vercel.app` wildcard is allowed outside production only: in production any other
 * Vercel tenant's app could otherwise be a trusted origin.
 */
export interface TrustedOriginInput {
  appEnv: string;
  siteUrl?: string;
  adminUrl?: string;
  /** Host (no scheme) the middleware treats as the admin app. */
  adminHost?: string;
  vercel: { url?: string; productionUrl?: string; branchUrl?: string };
}

/** Interim Vercel hostnames the live site and admin are also served on (docs/12 §2.1). */
const INTERIM_ORIGINS = [
  "https://codekraft.vercel.app",
  "https://codekraft-dusky.vercel.app",
  "https://codekraft-admin.vercel.app",
];

function wwwVariants(origin: string): string[] {
  let u: URL;
  try {
    u = new URL(origin);
  } catch {
    return [];
  }
  const host = u.hostname;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".vercel.app"))
    return [];
  if (!host.includes(".")) return [];
  const other = host.startsWith("www.") ? host.slice(4) : `www.${host}`;
  return [`${u.protocol}//${other}${u.port ? `:${u.port}` : ""}`];
}

export function resolveTrustedOrigins(input: TrustedOriginInput): string[] {
  const production = input.appEnv === "production";
  const adminHostOrigin = input.adminHost
    ? `${/^(localhost|[^/]+\.localhost)(:|$)/.test(input.adminHost) ? "http" : "https"}://${input.adminHost}`
    : undefined;
  const base = [input.siteUrl, input.adminUrl, adminHostOrigin].filter((u): u is string =>
    Boolean(u),
  );
  const list = [
    ...base,
    ...base.flatMap(wwwVariants),
    ...(production ? INTERIM_ORIGINS : ["https://*.vercel.app"]),
    ...(input.vercel.url ? [`https://${input.vercel.url}`] : []),
    ...(input.vercel.productionUrl ? [`https://${input.vercel.productionUrl}`] : []),
    ...(input.vercel.branchUrl ? [`https://${input.vercel.branchUrl}`] : []),
  ];
  return [...new Set(list)];
}
