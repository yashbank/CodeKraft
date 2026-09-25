import { BotIcon, ChevronRightIcon, FileTextIcon, HeartIcon, PackageOpenIcon } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { format } from "@/lib/money";
import { Banner } from "./Banner";
import { EmptyState } from "./EmptyState";
import { EntitlementCard } from "./EntitlementCard";
import { formatDate, relativeTime } from "./format";
import type { EntitlementSummary, InvoiceSummary, QuerySummary } from "./types";

export interface OverviewAction {
  id: string;
  tone: "warning" | "info" | "accent";
  title: string;
  detail: string;
  href: string;
  cta: string;
}

export interface OverviewScreenProps {
  firstName: string;
  emailVerified: boolean;
  actions: OverviewAction[];
  entitlements: EntitlementSummary[];
  invoices: InvoiceSummary[];
  queries: QuerySummary[];
  wishlistCount: number;
  now: string;
  links: {
    purchases: string;
    entitlement: (id: string) => string;
    invoices: string;
    queries: string;
    query: (id: string) => string;
    wishlist: string;
    chat: string;
  };
  loading?: boolean;
  /** Region-level fetch error (docs/07 §4.6): message shown with "Try again". */
  error?: string | null;
}

const TONE_RULE = {
  warning: "border-l-warning",
  info: "border-l-info",
  accent: "border-l-accent",
} as const;

/** SCR-ACC-01 — account overview: greeting, verification alert, action strip, products + side stack. */
export function OverviewScreen(props: OverviewScreenProps) {
  const {
    firstName,
    emailVerified,
    actions,
    entitlements,
    invoices,
    queries,
    wishlistCount,
    now,
    links,
  } = props;

  if (props.loading) return <OverviewSkeleton />;

  const empty =
    entitlements.length === 0 &&
    invoices.length === 0 &&
    queries.length === 0 &&
    actions.length === 0;

  return (
    <div className="space-y-6">
      <h1 className="text-h1 text-fg">Hi, {firstName}</h1>

      {!emailVerified ? (
        <Banner
          tone="warning"
          title="Verify your email to buy products"
          action={
            <Button size="sm" variant="secondary">
              Resend
            </Button>
          }
        >
          We sent a link to your inbox. Purchases and the assistant unlock once it&apos;s verified.
        </Banner>
      ) : null}

      {props.error ? (
        <Banner
          tone="danger"
          title="We couldn't load your dashboard"
          action={
            <Button size="sm" variant="secondary">
              Try again
            </Button>
          }
        >
          {props.error}
        </Banner>
      ) : null}

      {empty ? (
        <EmptyState
          icon={PackageOpenIcon}
          title="Welcome to CodeKraft"
          body="Nothing here yet. Explore products, or ask the assistant what fits your project."
          action={
            <>
              <Button asChild>
                <Link href="/products">Explore products</Link>
              </Button>
              <Button variant="secondary" asChild>
                <Link href={links.chat}>Ask the assistant</Link>
              </Button>
            </>
          }
          className="bg-surface"
        />
      ) : null}

      {actions.length > 0 ? (
        <section aria-labelledby="ov-actions" className="space-y-3">
          <h2
            id="ov-actions"
            className="text-overline font-semibold tracking-wider text-fg-muted uppercase"
          >
            Needs your attention
          </h2>
          <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {actions.map((a) => (
              <li
                key={a.id}
                className={`flex min-w-[260px] snap-start flex-col gap-2 rounded-lg border border-border border-l-4 bg-surface p-4 shadow-1 sm:min-w-0 ${TONE_RULE[a.tone]}`}
              >
                <p className="text-body-sm font-semibold text-fg">{a.title}</p>
                <p className="text-caption text-fg-muted">{a.detail}</p>
                <Button size="sm" className="mt-auto w-fit" asChild>
                  <Link href={a.href}>{a.cta}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!empty ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <section aria-labelledby="ov-products" className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 id="ov-products" className="text-h3 text-fg">
                Your products
              </h2>
              <Link
                href={links.purchases}
                className="text-body-sm text-accent-text hover:underline"
              >
                View all purchases
              </Link>
            </div>
            {entitlements.length === 0 ? (
              <EmptyState
                icon={PackageOpenIcon}
                title="No purchases yet"
                action={
                  <Button size="sm" asChild>
                    <Link href="/products">Explore products</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-3">
                {entitlements.slice(0, 5).map((e) => (
                  <li key={e.id}>
                    <EntitlementCard entitlement={e} detailHref={links.entitlement(e.id)} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="space-y-4">
            <Card className="gap-4 py-5">
              <CardHeader className="px-5">
                <CardTitle className="flex items-center justify-between">
                  Recent invoices
                  <Link
                    href={links.invoices}
                    className="text-body-sm font-normal text-accent-text hover:underline"
                  >
                    All
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5">
                {invoices.length === 0 ? (
                  <p className="text-body-sm text-fg-muted">No invoices yet</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {invoices.slice(0, 3).map((inv) => (
                      <li key={inv.id} className="flex items-center gap-3 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-mono text-body-sm text-fg">{inv.number}</p>
                          <p className="text-caption text-fg-muted">{formatDate(inv.date)}</p>
                        </div>
                        <span className="font-mono text-body-sm tnum text-fg">
                          {format(inv.amount)}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Download PDF for ${inv.number}`}
                        >
                          <FileTextIcon aria-hidden />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className="gap-4 py-5">
              <CardHeader className="px-5">
                <CardTitle className="flex items-center justify-between">
                  Open queries
                  <Link
                    href={links.queries}
                    className="text-body-sm font-normal text-accent-text hover:underline"
                  >
                    All
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5">
                {queries.length === 0 ? (
                  <p className="text-body-sm text-fg-muted">No open queries</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {queries.slice(0, 3).map((q) => (
                      <li key={q.id}>
                        <Link
                          href={links.query(q.id)}
                          className="flex items-center gap-3 py-2.5 hover:text-accent-text"
                        >
                          <span
                            aria-hidden
                            className={`size-2 shrink-0 rounded-full ${q.unread ? "bg-accent" : "bg-transparent"}`}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body-sm font-medium text-fg">
                              {q.subject}
                            </span>
                            <span className="block text-caption text-fg-muted">
                              {relativeTime(q.lastActivityAt, now)}
                            </span>
                          </span>
                          <StatusBadge kind="queries.status" value={q.status} size="sm" />
                          <ChevronRightIcon aria-hidden className="size-4 text-fg-subtle" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href={links.wishlist}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-1 hover:border-accent"
              >
                <HeartIcon aria-hidden className="size-5 text-accent-text" />
                <span className="text-body-sm">
                  <span className="block font-semibold text-fg">Wishlist</span>
                  <span className="text-fg-muted">{wishlistCount} saved</span>
                </span>
              </Link>
              <Link
                href={links.chat}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-1 hover:border-accent"
              >
                <BotIcon aria-hidden className="size-5 text-accent-text" />
                <span className="text-body-sm">
                  <span className="block font-semibold text-fg">Ask the assistant</span>
                  <span className="text-fg-muted">Orders, downloads, renewals</span>
                </span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your dashboard">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[7fr_5fr]">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    </div>
  );
}
