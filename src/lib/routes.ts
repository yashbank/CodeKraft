/**
 * Application routes and URL builders (MASTER_SPEC §7, ui/sitemap.md §3).
 */
export function quotePayUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://codekraft.dev";
  return `${baseUrl}/quote/${token}`;
}

export function quoteRelativePath(token: string): string {
  return `/quote/${token}`;
}
