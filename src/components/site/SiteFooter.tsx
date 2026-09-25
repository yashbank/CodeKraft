import Link from "next/link";

import { Container } from "./Container";
import { LEGAL_LINKS, SITE_NAV } from "./nav";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";

/**
 * Site footer — docs/07 §3.2 / docs/08 §6.4. Four columns at md+: wordmark + positioning line +
 * theme toggle · Explore · Company (Contact = inquiry form, Sign in) · Legal. No email, phone,
 * WhatsApp, social icons or newsletter box (D-808). Governing law line (D-1504).
 */
export function SiteFooter({ themeToggleEnabled = false }: { themeToggleEnabled?: boolean }) {
  const year = new Date().getUTCFullYear();
  const explore = SITE_NAV.filter((i) => i.href !== "/contact");
  return (
    <footer className="border-t border-border bg-surface">
      <Container className="py-12 lg:py-16">
        <div className="grid gap-10 md:grid-cols-4 md:gap-8">
          <div className="space-y-4">
            <Wordmark className="h-6 text-fg" />
            <p className="max-w-[28ch] text-body-sm text-fg-muted">
              A software studio that builds for clients and sells what it has perfected.
            </p>
            <ThemeToggle enabled={themeToggleEnabled} />
          </div>
          <FooterColumn title="Explore" links={explore} />
          <FooterColumn
            title="Company"
            links={[
              { href: "/contact", label: "Contact (inquiry form)" },
              { href: "/auth/login", label: "Sign in" },
            ]}
          />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-caption text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} CodeKraft. All rights reserved.</p>
          <p>Governed by the laws of India.</p>
        </div>
      </Container>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <nav aria-label={title}>
      <h2 className="text-overline tracking-wider text-fg-muted uppercase">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="rounded-xs text-body-sm text-fg transition-colors hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
