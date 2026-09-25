import { BoxIcon } from "lucide-react";

import { cn } from "@/components/ui/_utils";

/**
 * CSS-only stand-in for the WebGL hero scene (`components/three/HeroScene`, P7, flag
 * `three_hero`). Token gradients + glow, `aria-hidden` (the poster alt lives on the real image).
 * Same box the canvas will occupy (columns 7–12 at lg+), so layout does not shift later.
 */
export function HeroPoster({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-border bg-surface shadow-glow-soft lg:aspect-auto lg:h-full",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[image:var(--ck-gradient-glow)]" />
      <div className="absolute inset-0 bg-[image:var(--ck-gradient-glow-cyan)] opacity-70" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[image:var(--ck-gradient-fade-canvas)]" />
      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-glass px-6 py-5 text-center backdrop-blur-glass">
          <span className="inline-flex size-14 items-center justify-center rounded-full bg-[image:var(--ck-gradient-brand)] text-inverse-fg shadow-glow">
            <BoxIcon className="size-7" />
          </span>
          <span className="text-body-sm font-medium text-fg">3D hero scene (P7)</span>
          <span className="max-w-[26ch] text-caption text-fg-muted">
            react-three-fiber at lg+ · static poster elsewhere
          </span>
        </div>
      </div>
    </div>
  );
}
