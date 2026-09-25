import { cn } from "@/components/ui/_utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-md bg-elevated", className)}
      {...props}
    />
  );
}

export { Skeleton };
