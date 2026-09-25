import { cn } from "@/components/ui/_utils";

/**
 * Inline copy of /public/brand/wordmark.svg (docs/08 §3.1) so the K chevron can read the accent
 * token; ink follows `currentColor`. Min width 112 px.
 */
export function Wordmark({
  className,
  title = "CodeKraft",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 445 96"
      role="img"
      aria-label={title}
      fill="currentColor"
      className={cn("h-6 w-auto min-w-[112px]", className)}
    >
      <path
        d="M50.95 30.94A25.5 25.5 0 1 0 50.95 65.06M70.28 57A18 16.5 0 1 0 106.28 57A18 16.5 0 1 0 70.28 57M127.28 57A17 16.5 0 1 0 161.28 57A17 16.5 0 1 0 127.28 57M161.28 16V80M182.28 57H218.28A18 16.5 0 1 0 214.46 67.16M241.28 16V80M301.96 34V80M301.96 57A16.5 16.5 0 0 1 318.46 40.5H322.46M334.96 57A17 16.5 0 1 0 368.96 57A17 16.5 0 1 0 334.96 57M368.96 34V80M383.46 40.5H406.46M393.46 80V36.5A14 14 0 0 1 407.46 22.5H410.46M417.46 40.5H440.46M427.46 24V61.5A12 12 0 0 0 439.46 73.5H444.46"
        fill="none"
        stroke="currentColor"
        strokeWidth="13"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
      <path
        d="M252.78 25L278.78 48L252.78 71"
        fill="none"
        stroke="currentColor"
        strokeWidth="13"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        className="text-accent"
      />
    </svg>
  );
}
