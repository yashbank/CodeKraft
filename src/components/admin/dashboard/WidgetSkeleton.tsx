import { Skeleton } from "@/components/ui/skeleton";

/** Fixed body height shared with WidgetFrame so swapping skeleton <-> content never shifts layout. */
export const WIDGET_BODY_HEIGHT = 168;

export function WidgetSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading widget"
      data-testid="widget-skeleton"
      style={{ height: WIDGET_BODY_HEIGHT }}
      className="flex flex-col gap-3"
    >
      <Skeleton className="h-7 w-1/3" />
      <Skeleton className="w-full flex-1" />
    </div>
  );
}
