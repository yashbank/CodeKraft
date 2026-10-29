"use client";

import Link from "next/link";

import { useSiteName } from "@/components/brand/site-brand";
import { useSession } from "@/modules/auth/client";
import type { SiteContact } from "@/lib/site-brand";
import { Container } from "./Container";
import { LEGAL_LINKS, SITE_NAV } from "./nav";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";

/**
 * Site footer — docs/07 §3.2 / docs/08 §6.4. Four columns at md+: wordmark + positioning line +
 * theme toggle · Explore · Company (Contact = inquiry form, Sign in / My account, session-aware
 * like `SiteHeader`) · Legal. No email, phone, WhatsApp, social icons or newsletter box (D-808).
 * Governing law line (D-1504).
 */
export function SiteFooter({
  themeToggleEnabled = false,
  contact,
}: {
  themeToggleEnabled?: boolean;
  contact?: SiteContact;
}) {
  const { data: session } = useSession();
  const [authHref, authLabel] = session ? ["/account", "My account"] : ["/auth/login", "Sign in"];
  const year = new Date().getUTCFullYear();
  const siteName = useSiteName();
  const explore = SITE_NAV.filter((i) => i.href !== "/contact");
  return (
    <footer className="border-t border-border bg-surface print:hidden">
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
              { href: authHref, label: authLabel },
            ]}
          />
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-border pt-6 text-caption text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {siteName}. All rights reserved.
          </p>
          <p>Governed by the laws of India.</p>
        </div>
        <div className="mt-4 space-y-1 text-caption text-fg-subtle">
          {contact?.legalName ? <p>{contact.legalName}</p> : null}
          {contact?.address ? <p>{contact.address}</p> : null}
          {contact?.email ? (
            <p>
              <a href={`mailto:${contact.email}`}>{contact.email}</a>
            </p>
          ) : null}
          {contact?.phones ? <p>{contact.phones}</p> : null}
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
      <ul className="mt-3 lg:mt-4 lg:space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="inline-flex min-h-10 min-w-10 items-center rounded-xs text-body-sm text-fg transition-colors lg:min-h-0 lg:min-w-0 hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
