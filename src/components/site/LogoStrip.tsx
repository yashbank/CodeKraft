import { cn } from "@/components/ui/_utils";

import type { ClientLogo } from "./types";

/**
 * Client logo strip (docs/08 §6.5 trust row): greyscale `fg-subtle` at 70 %, colour on hover.
 * Text placeholders until `client_logos` media lands (P7 swaps in `next/image`).
 */
export function LogoStrip({
  logos,
  label = "Clients",
  className,
}: {
  logos: ClientLogo[];
  label?: string;
  className?: string;
}) {
  if (logos.length === 0) return null;
  return (
    <ul
      aria-label={label}
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-10 gap-y-4 sm:justify-between",
        className,
      )}
    >
      {logos.map((l) => (
        <li
          key={l.id}
          className="font-display text-body-lg font-semibold tracking-tight text-fg-subtle opacity-70 transition-[color,opacity] duration-(--ck-motion-duration-sm) hover:text-fg hover:opacity-100"
        >
          {l.name}
        </li>
      ))}
    </ul>
  );
}
