import { CircleCheckIcon, CircleIcon, LoaderCircleIcon } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/components/ui/_utils";
import { Banner } from "../Banner";
import { formatDate } from "../format";
import type { ServiceStep } from "../types";

/**
 * Service checklist (docs/08 §6.13, D-608): progress bar with `aria-valuenow`, 44px rows with
 * open / in-progress / done icons, admin note, completed timestamp; "Fulfilled" banner when all done.
 */
export function ServicePanel({ steps }: { steps: ServiceStep[] }) {
  const done = steps.filter((s) => s.state === "done").length;
  const all = steps.length > 0 && done === steps.length;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-h3 text-fg">Service progress</h2>
        <span className="text-body-sm text-fg-muted">
          {done} of {steps.length} steps complete
        </span>
      </div>
      <Progress
        value={steps.length ? Math.round((done / steps.length) * 100) : 0}
        aria-label={`${done} of ${steps.length} steps complete`}
      />
      {all ? (
        <Banner tone="success" title="Fulfilled">
          All steps are done — thanks for working with us.
        </Banner>
      ) : null}
      <ol className="divide-y divide-border rounded-lg border border-border bg-surface">
        {steps.map((s, i) => (
          <li key={s.id} className="flex gap-3 p-4">
            <span className="mt-0.5 shrink-0" aria-hidden>
              {s.state === "done" ? (
                <CircleCheckIcon className="size-5 text-success" />
              ) : s.state === "in_progress" ? (
                <LoaderCircleIcon className="size-5 animate-spin text-info" />
              ) : (
                <CircleIcon className="size-5 text-fg-subtle" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-body font-medium",
                  s.state === "open" ? "text-fg-muted" : "text-fg",
                )}
              >
                {i + 1}. {s.title}
                <span className="sr-only">
                  {s.state === "done"
                    ? " — done"
                    : s.state === "in_progress"
                      ? " — in progress"
                      : " — not started"}
                </span>
              </p>
              {s.description ? <p className="text-body-sm text-fg-muted">{s.description}</p> : null}
              {s.note ? (
                <p className="mt-1 text-caption text-fg-muted">Note from CodeKraft: {s.note}</p>
              ) : null}
              {s.doneAt ? (
                <p className="text-caption text-fg-subtle">Completed {formatDate(s.doneAt)}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
