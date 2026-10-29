import { cn } from "./_utils";
import { Skeleton } from "./skeleton";

export type SkeletonKind = "list" | "detail" | "cards" | "article" | "form" | "dashboard" | "chat";

const rows = (n: number) => Array.from({ length: n }, (_, i) => i);

function Title({ actions = false }: { actions?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Skeleton className="h-9 w-56 max-w-[60%]" />
      {actions ? <Skeleton className="h-10 w-28" /> : null}
    </div>
  );
}

/**
 * Route-level loading shapes (P14-12b), one per page family, so the placeholder matches the layout
 * that replaces it: `list` = title + filter bar + table rows, `detail` = title + two columns,
 * `cards` = grid of cards, `article` = headline + paragraphs, `form` = labelled fields,
 * `dashboard` = stat tiles + chart + table, `chat` = message bubbles + composer.
 */
export function PageSkeleton({ kind, className }: { kind: SkeletonKind; className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Loading"
      data-skeleton={kind}
      className={cn("mx-auto w-full max-w-[1200px] space-y-6 px-4 py-6 lg:px-8", className)}
    >
      {kind === "list" ? (
        <>
          <Title actions />
          <div className="flex gap-3">
            <Skeleton className="h-10 flex-1 max-w-sm" />
            <Skeleton className="h-10 w-28" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            {rows(7).map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        </>
      ) : null}
      {kind === "detail" ? (
        <>
          <Title actions />
          <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </>
      ) : null}
      {kind === "cards" ? (
        <>
          <Title />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows(6).map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-[16/10] w-full" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        </>
      ) : null}
      {kind === "article" ? (
        <div className="mx-auto max-w-3xl space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-12 w-4/5" />
          <Skeleton className="h-4 w-56" />
          {rows(8).map((i) => (
            <Skeleton key={i} className={cn("h-4", i % 4 === 3 ? "w-2/3" : "w-full")} />
          ))}
        </div>
      ) : null}
      {kind === "form" ? (
        <div className="max-w-2xl space-y-5">
          <Title />
          {rows(5).map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <Skeleton className="h-10 w-32" />
        </div>
      ) : null}
      {kind === "dashboard" ? (
        <>
          <Title />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {rows(4).map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
          <Skeleton className="h-48 w-full" />
        </>
      ) : null}
      {kind === "chat" ? (
        <div className="space-y-4">
          <Title />
          <Skeleton className="h-16 w-3/5" />
          <Skeleton className="ml-auto h-12 w-2/5" />
          <Skeleton className="h-20 w-3/5" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : null}
    </div>
  );
}
