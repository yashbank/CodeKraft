import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { format } from "@/lib/money";
import { assertCurrency } from "@/lib/money";
import { getSiteRequestContext } from "@/lib/authz/site-request-context";
import { quoteRelativePath } from "@/lib/routes";
import { listMyQuotesQuery } from "@/modules/quotes/queries";

export const dynamic = "force-dynamic";

/** Account > Quotes: custom quotes addressed to the customer, with a link to review/accept/reject. */
export default async function AccountQuotesPage() {
  const ctx = await getSiteRequestContext();
  const res = await listMyQuotesQuery({}, ctx);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-h2 text-fg">Quotes</h1>
        <p className="text-body-sm text-fg-muted">Custom quotes prepared for you.</p>
      </header>
      {!res.ok ? (
        <p role="alert" className="text-body-sm text-danger">
          Couldn&apos;t load your quotes: {res.error.message}
        </p>
      ) : res.data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-body-sm text-fg-muted">
          No quotes yet. When we send you a custom quote it appears here.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {res.data.map((q) => {
            const total = q.amountMinor + Math.round((q.amountMinor * q.taxBps) / 10000);
            const open = q.status === "sent" || q.status === "viewed";
            return (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="space-y-1">
                  <p className="font-medium text-fg">{q.title}</p>
                  <p className="flex items-center gap-2 text-caption text-fg-muted">
                    <StatusBadge kind="custom_quotes.status" value={q.status} size="sm" />
                    {q.expiresAt ? `valid until ${q.expiresAt.toISOString().slice(0, 10)}` : null}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono">
                    {format({ amountMinor: total, currency: assertCurrency(q.currency) })}
                  </span>
                  <Button size="sm" variant={open ? "default" : "secondary"} asChild>
                    <Link href={quoteRelativePath(q.token)}>{open ? "Review" : "View"}</Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
