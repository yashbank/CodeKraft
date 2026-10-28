import { cn } from "@/components/ui/_utils";

import { SERVICE_ICON_MAP } from "./service-icons";
import type { ServiceIconName } from "./types";

/** Decorative service glyph on an accent-soft tile (SVG stroke draw-in is a P7 motion item). */
export function ServiceIcon({ name, className }: { name: ServiceIconName; className?: string }) {
  const Icon = SERVICE_ICON_MAP[name] ?? SERVICE_ICON_MAP.sparkles;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-12 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-text",
        className,
      )}
    >
      <Icon className="size-6" />
    </span>
  );
}
