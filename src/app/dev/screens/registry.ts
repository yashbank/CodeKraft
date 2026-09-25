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
  {
    id: "SCR-AUTH-01",
    title: "Login (+ admin TOTP variant)",
    href: "/dev/screens/account/login",
    group: "auth",
    spec: "ui/screens/user/SCR-AUTH-01-login.md",
  },
  {
    id: "SCR-AUTH-02",
    title: "Register",
    href: "/dev/screens/account/register",
    group: "auth",
    spec: "ui/screens/user/SCR-AUTH-02-register.md",
  },
  {
    id: "SCR-AUTH-03",
    title: "Verify email",
    href: "/dev/screens/account/verify-email",
    group: "auth",
    spec: "ui/screens/user/SCR-AUTH-03-verify-email.md",
  },
  {
    id: "SCR-AUTH-04",
    title: "Reset password",
    href: "/dev/screens/account/reset-password",
    group: "auth",
    spec: "ui/screens/user/SCR-AUTH-04-reset-password.md",
  },
  {
    id: "SCR-AUTH-05",
    title: "Phone OTP (flagged)",
    href: "/dev/screens/account/phone-otp",
    group: "auth",
    spec: "ui/screens/user/SCR-AUTH-05-phone-otp.md",
  },
  {
    id: "SCR-ACC-01",
    title: "Account overview",
    href: "/dev/screens/account/overview",
    group: "account",
    spec: "ui/screens/user/SCR-ACC-01-overview.md",
  },
  {
    id: "SCR-ACC-02",
    title: "Purchases & access",
    href: "/dev/screens/account/purchases",
    group: "account",
    spec: "ui/screens/user/SCR-ACC-02-purchases.md",
  },
  {
    id: "SCR-ACC-03",
    title: "Entitlement detail",
    href: "/dev/screens/account/entitlement",
    group: "account",
    spec: "ui/screens/user/SCR-ACC-03-entitlement-detail.md",
  },
  {
    id: "SCR-ACC-04",
    title: "Invoices & payments",
    href: "/dev/screens/account/invoices",
    group: "account",
    spec: "ui/screens/user/SCR-ACC-04-invoices-payments.md",
  },
  {
    id: "SCR-ACC-05",
    title: "Queries (list)",
    href: "/dev/screens/account/queries",
    group: "account",
    spec: "ui/screens/user/SCR-ACC-05-queries.md",
  },
  {
    id: "SCR-ACC-05/thread",
    title: "Query thread",
    href: "/dev/screens/account/query-thread",
    group: "account",
    spec: "ui/screens/user/SCR-ACC-05-queries.md",
  },
  {
    id: "SCR-ACC-06",
    title: "Chatbot",
    href: "/dev/screens/account/chat",
    group: "account",
    spec: "ui/screens/user/SCR-ACC-06-chatbot.md",
  },
  {
    id: "SCR-ACC-07",
    title: "Wishlist",
    href: "/dev/screens/account/wishlist",
    group: "account",
    spec: "ui/screens/user/SCR-ACC-07-wishlist.md",
  },
  {
    id: "SCR-ACC-08",
    title: "Notifications",
    href: "/dev/screens/account/notifications",
    group: "account",
    spec: "ui/screens/user/SCR-ACC-08-notifications.md",
  },
  {
    id: "SCR-ACC-09",
    title: "Profile & settings",
    href: "/dev/screens/account/settings",
    group: "account",
    spec: "ui/screens/user/SCR-ACC-09-profile-settings.md",
  },
  {
    id: "SCR-ACC-10",
    title: "Checkout",
    href: "/dev/screens/account/checkout",
    group: "account",
    spec: "ui/screens/user/SCR-ACC-10-checkout.md",
  },
  {
    id: "SCR-ACC-11",
    title: "Order status",
    href: "/dev/screens/account/order-status",
    group: "account",
    spec: "ui/screens/user/SCR-ACC-11-order-status.md",
  },
  {
    id: "SCR-ACC-12",
    title: "Custom quote",
    href: "/dev/screens/account/quote",
    group: "account",
    spec: "ui/screens/user/SCR-ACC-12-custom-quote.md",
  },
  // --- admin (agent C appends)
];
