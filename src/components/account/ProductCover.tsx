import { cn } from "@/components/ui/_utils";

/** Cover placeholder: product initials on the brand gradient (real covers arrive with media in P7). */
export function ProductCover({
  name,
  className,
  ratio = "square",
}: {
  name: string;
  className?: string;
  ratio?: "square" | "wide";
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-[image:var(--ck-gradient-brand)] font-display text-h4 font-semibold text-inverse-fg",
        ratio === "square" ? "size-16" : "aspect-[16/10] w-full",
        className,
      )}
    >
      {initials}
    </div>
  );
}
