import { headers } from "next/headers";

import { ErrorPanel } from "@/components/site/ErrorPanel";
import { SiteShell } from "@/components/site/SiteShell";
import { SERVICE_OPTIONS } from "@/app/dev/screens/_fixtures/site";

/** SCR-SITE-11 — site 404 inside the real site shell: logo, search, helpful links (P14-12b). */
export default async function NotFound() {
  // Admin host: never show customer-site chrome/links (BUG-068); set by src/middleware.ts.
  if ((await headers()).get("x-host-kind") === "admin") {
    return (
      <main className="mx-auto max-w-xl p-8">
        <ErrorPanel
          code="404"
          title="Page not found"
          body="That page doesn't exist."
          links={[{ href: "/admin/dashboard", label: "Back to dashboard" }]}
        />
      </main>
    );
  }
  return (
    <SiteShell serviceOptions={SERVICE_OPTIONS} themeToggleEnabled>
      <ErrorPanel
        code="404"
        title="We couldn't find that page"
        body="It may have moved, or the link might be out of date."
        searchAction="/products"
        links={[
          { href: "/", label: "Go home" },
          { href: "/products", label: "Browse products" },
          { href: "/services", label: "Services" },
          { href: "/contact", label: "Contact us" },
        ]}
      />
    </SiteShell>
  );
}
