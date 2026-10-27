import { cn } from "@/components/ui/_utils";

import { LogoMark } from "./LogoMark";
import type { ClientLogo } from "./types";

/**
 * Client logo strip (docs/08 §6.5 trust row): greyscale `fg-subtle` at 70 %, colour on hover.
 * Renders the uploaded logo image (Admin → Content → Testimonials & logos) when there is one,
 * otherwise the client name as text.
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
      {logos.map((l) => {
        const mark = l.logoUrl ? <LogoMark src={l.logoUrl} name={l.name} /> : l.name;
        return (
          <li
            key={l.id}
            className="group font-display text-body-lg font-semibold tracking-tight text-fg-subtle opacity-70 transition-[color,opacity] duration-(--ck-motion-duration-sm) hover:text-fg hover:opacity-100"
          >
            {l.href ? (
              <a href={l.href} target="_blank" rel="noopener noreferrer">
                {mark}
              </a>
            ) : (
              mark
            )}
          </li>
        );
      })}
    </ul>
  );
}
