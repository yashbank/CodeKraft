import type { ReactNode } from "react";

import { cn } from "@/components/ui/_utils";

/** Eyebrow + heading + optional lede, used by every list/landing section. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  lede,
  as: Tag = "h2",
  size = "h2",
  align = "left",
  action,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  as?: "h1" | "h2" | "h3";
  size?: "display-xl" | "display-lg" | "h1" | "h2" | "h3";
  align?: "left" | "center";
  /** Trailing link/button rendered beside the heading at md+. */
  action?: ReactNode;
  className?: string;
}) {
  const sizeClass = {
    "display-xl": "text-display-xl",
    "display-lg": "text-display-lg",
    h1: "text-h1",
    h2: "text-h2",
    h3: "text-h3",
  }[size];
  return (
    <div
      className={cn(
        "flex flex-col gap-4 md:flex-row md:items-end md:justify-between",
        align === "center" && "items-center text-center md:flex-col md:items-center",
        className,
      )}
    >
      <div className={cn("space-y-3", align === "center" && "mx-auto")}>
        {eyebrow ? (
          <p className="text-overline font-semibold tracking-wider text-accent-text uppercase">
            {eyebrow}
          </p>
        ) : null}
        <Tag id={id} className={cn("font-display text-balance text-fg", sizeClass)}>
          {title}
        </Tag>
        {lede ? <p className="max-w-[55ch] text-body-lg text-fg-muted">{lede}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
