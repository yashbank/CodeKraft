import type { SiteNavItem } from "./types";

/** docs/07 §3.1 centre nav; shared by header, drawer and footer "Explore". */
export const SITE_NAV: SiteNavItem[] = [
  { href: "/services", label: "Services" },
  { href: "/products", label: "Products" },
  { href: "/projects", label: "Projects" },
  { href: "/blog", label: "Blog" },
  { href: "/contact", label: "Contact" },
];

/** docs/07 §3.2 footer "Legal" column (D-807). */
export const LEGAL_LINKS: SiteNavItem[] = [
  { href: "/legal/privacy", label: "Privacy" },
  { href: "/legal/terms", label: "Terms" },
  { href: "/legal/refunds", label: "Refund & cancellation" },
  { href: "/legal/license", label: "Product license" },
];
