import { SITE_NAV } from "@/components/site/nav";
import { hrefSchema } from "@/modules/content/contracts";

export const CTA_NONE = "none";
export const CTA_OTHER = "other";

/** Known internal CTA destinations: the public nav plus the inquiry sheet and sign-up. */
export const CTA_ROUTES: { href: string; label: string }[] = [
  { href: "/contact#inquiry", label: "Project inquiry sheet" },
  ...SITE_NAV.map((n) => ({
    href: n.href,
    label: n.href === "/projects" ? "Projects / case studies" : n.label,
  })),
  { href: "/auth/register", label: "Sign up" },
];

/** Select value for a stored href: a known route, "none" when empty, else "other". */
export function ctaSelectValue(href: string | undefined): string {
  if (!href) return CTA_NONE;
  return CTA_ROUTES.some((r) => r.href === href) ? href : CTA_OTHER;
}

/** Final href from the picker + free-text input; null when invalid (same rule the server enforces). */
export function resolveCtaHref(selected: string, otherUrl: string): string | null {
  if (selected === CTA_NONE) return "";
  const parsed = hrefSchema.safeParse(selected === CTA_OTHER ? otherUrl : selected);
  return parsed.success ? parsed.data : null;
}
