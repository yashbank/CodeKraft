import Image from "next/image";
import { cn } from "@/components/ui/_utils";

/**
 * 3D Isometric architectural render hero showcase with ambient glow & glass borders.
 */
export function HeroPoster({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "group relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl transition-all duration-500 hover:border-cyan-500/30 hover:shadow-cyan-500/10 lg:aspect-auto lg:h-full",
        className,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/10 via-transparent to-violet-500/10 opacity-70 transition-opacity group-hover:opacity-100" />
      <Image
        src="/images/hero-3d.jpg"
        alt="CodeKraft 3D System Architecture Render"
        fill
        priority
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-surface/80 p-4 backdrop-blur-md">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Architecture Node</p>
            <p className="text-sm font-medium text-fg">Production Engine & Digital Assets</p>
          </div>
          <span className="flex size-2.5 rounded-full bg-cyan-400 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
