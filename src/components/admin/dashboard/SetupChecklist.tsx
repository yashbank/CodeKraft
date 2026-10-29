"use client";

import { CheckCircle2Icon, CircleIcon, XIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/_utils";
import type { SetupItem } from "@/lib/admin/setup-checklist";

/** First-run checklist for super admins; dismissal is per browser, hidden once every item is done. */
export function SetupChecklist({
  items,
  userId,
}: Readonly<{ items: SetupItem[]; userId: string }>) {
  const storageKey = `ck.setup-dismissed.${userId}`;
  const [dismissed, setDismissed] = React.useState(true); // hidden until localStorage is read
  React.useEffect(() => setDismissed(localStorage.getItem(storageKey) === "1"), [storageKey]);

  const done = items.filter((i) => i.done).length;
  if (dismissed || done === items.length) return null;

  return (
    <section
      aria-labelledby="setup-checklist-title"
      className="mb-6 rounded-lg border bg-surface p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="setup-checklist-title" className="text-h4 font-semibold">
            Finish setting up
          </h2>
          <p className="text-body-sm text-fg-muted">
            {done} of {items.length} done
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss setup checklist"
          onClick={() => {
            localStorage.setItem(storageKey, "1");
            setDismissed(true);
          }}
        >
          <XIcon aria-hidden />
        </Button>
      </div>
      <ul className="mt-3 grid gap-1 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.id}>
            <Link
              href={i.href}
              className={cn(
                "flex min-h-11 items-center gap-2 rounded-md px-2 text-body-sm hover:bg-accent-soft",
                i.done && "text-fg-muted line-through",
              )}
            >
              {i.done ? (
                <CheckCircle2Icon aria-hidden className="size-4 text-success" />
              ) : (
                <CircleIcon aria-hidden className="size-4" />
              )}
              <span>{i.label}</span>
              <span className="sr-only">{i.done ? "(done)" : "(to do)"}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
