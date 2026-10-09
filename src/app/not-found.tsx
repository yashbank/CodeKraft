import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SiteShell } from "@/components/site/SiteShell";
import { SERVICE_OPTIONS } from "@/app/dev/screens/_fixtures/site";

/** SCR-SITE-11 — site 404: "We couldn't find that page", Go home + Browse products, a
 * products search. Wrapped in the real site shell so it matches every other page. */
export default function NotFound() {
  return (
    <SiteShell serviceOptions={SERVICE_OPTIONS} themeToggleEnabled>
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6 text-center">
          <p className="text-overline text-fg-muted uppercase">404</p>
          <h1 className="text-h2">We couldn&apos;t find that page</h1>
          <p className="text-body text-fg-muted">
            It may have moved, or the link might be out of date.
          </p>
          <form action="/products" className="flex gap-2">
            <Input
              name="q"
              type="search"
              placeholder="Search products"
              aria-label="Search products"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild>
              <Link href="/">Go home</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/products">Browse products</Link>
            </Button>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
