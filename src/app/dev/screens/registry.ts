/**
 * Screen preview registry (dev only). Each entry maps a designed screen (ui/screens/**) to its
 * preview route under /dev/screens. Agents append entries for the screens they build.
 */
export interface ScreenEntry {
  id: string; // SCR-SITE-01 …
  title: string;
  href: string; // /dev/screens/site/landing
  group: "site" | "auth" | "account" | "admin";
  spec: string; // ui/screens/... path
}

export const SCREENS: ScreenEntry[] = [
  // --- site (agent A appends)
  {
    id: "SCR-SITE-01",
    title: "Landing (story chapters)",
    href: "/dev/screens/site/landing",
    group: "site",
    spec: "ui/screens/user/SCR-SITE-01-landing.md",
  },
  {
    id: "SCR-SITE-02",
    title: "Services",
    href: "/dev/screens/site/services",
    group: "site",
    spec: "ui/screens/user/SCR-SITE-02-services.md",
  },
  {
    id: "SCR-SITE-03",
    title: "Products list",
    href: "/dev/screens/site/products",
    group: "site",
    spec: "ui/screens/user/SCR-SITE-03-products-list.md",
  },
  {
    id: "SCR-SITE-04",
    title: "Product detail",
    href: "/dev/screens/site/product-detail",
    group: "site",
    spec: "ui/screens/user/SCR-SITE-04-product-detail.md",
  },
  {
    id: "SCR-SITE-05",
    title: "Case studies list",
    href: "/dev/screens/site/case-studies",
    group: "site",
    spec: "ui/screens/user/SCR-SITE-05-case-studies-list.md",
  },
  {
    id: "SCR-SITE-06",
    title: "Case study detail",
    href: "/dev/screens/site/case-study-detail",
    group: "site",
    spec: "ui/screens/user/SCR-SITE-06-case-study-detail.md",
  },
  {
    id: "SCR-SITE-07",
    title: "Blog index",
    href: "/dev/screens/site/blog",
    group: "site",
    spec: "ui/screens/user/SCR-SITE-07-blog-index.md",
  },
  {
    id: "SCR-SITE-08",
    title: "Blog post",
    href: "/dev/screens/site/blog-post",
    group: "site",
    spec: "ui/screens/user/SCR-SITE-08-blog-post.md",
  },
  {
    id: "SCR-SITE-09",
    title: "Contact / inquiry",
    href: "/dev/screens/site/contact",
    group: "site",
    spec: "ui/screens/user/SCR-SITE-09-contact.md",
  },
  {
    id: "SCR-SITE-10",
    title: "Legal page",
    href: "/dev/screens/site/legal",
    group: "site",
    spec: "ui/screens/user/SCR-SITE-10-legal-page.md",
  },
  {
    id: "SCR-SITE-11",
    title: "System pages (404, error, offline)",
    href: "/dev/screens/site/system?state=not_found",
    group: "site",
    spec: "ui/screens/user/SCR-SITE-11-system-pages.md",
  },
  // --- auth + account + checkout (agent B appends)
  // --- admin (agent C appends)
];
