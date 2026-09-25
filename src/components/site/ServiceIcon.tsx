import {
  CloudIcon,
  CompassIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  PenToolIcon,
  SmartphoneIcon,
  SparklesIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/components/ui/_utils";

import type { ServiceIconName } from "./types";

const ICONS: Readonly<Record<ServiceIconName, LucideIcon>> = {
  layout: LayoutDashboardIcon,
  smartphone: SmartphoneIcon,
  cloud: CloudIcon,
  globe: GlobeIcon,
  "pen-tool": PenToolIcon,
  sparkles: SparklesIcon,
  wrench: WrenchIcon,
  compass: CompassIcon,
};

/** Decorative service glyph on an accent-soft tile (SVG stroke draw-in is a P7 motion item). */
export function ServiceIcon({ name, className }: { name: ServiceIconName; className?: string }) {
  const Icon = ICONS[name];
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
