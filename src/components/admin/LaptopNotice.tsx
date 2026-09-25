import Link from "next/link";
import { LaptopIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * "Open on a laptop" — docs/07 §3.4. Rendered below `lg` for every admin screen that is not
 * one of the three read-mostly surfaces: title, an optional one-line summary, links to
 * Approvals and Notifications, and no forms, tables or actions.
 */
export function LaptopNotice({
  title,
  summary,
  approvalsHref,
  notificationsHref,
  as: Heading = "h1",
}: {
  title: string;
  summary?: string;
  approvalsHref: string;
  notificationsHref: string;
  /** Heading level; use "h2" when the page already renders its own h1 (read-mostly screens). */
  as?: "h1" | "h2";
}) {
  return (
    <section
      aria-labelledby="laptop-notice-title"
      className="mx-auto max-w-md space-y-4 py-10 text-center"
    >
      <LaptopIcon aria-hidden className="mx-auto size-10 text-fg-subtle" />
      <Heading id="laptop-notice-title" className="text-h2">
        {title}
      </Heading>
      {summary ? <p className="text-body text-fg-muted">{summary}</p> : null}
      <p className="text-body-sm text-fg-muted">
        This screen is designed for laptops (1024 px and wider). On a phone or tablet you can review
        approvals, confirm payments and read notifications.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild variant="secondary" size="sm">
          <Link href={approvalsHref}>Approvals</Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href={notificationsHref}>Notifications</Link>
        </Button>
      </div>
    </section>
  );
}
