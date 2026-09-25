import type { ReactNode } from "react";

import { cn } from "@/components/ui/_utils";

/**
 * Site content column — docs/07 §5: 16 px gutters on phone, 1320 px at xl, 1440 px at 2xl,
 * 1920 px with 96 px gutters at tv. TV type scaling comes from the html font-size, not from here.
 */
export function Container({
  className,
  size = "site",
  children,
}: {
  className?: string;
  /** `site` = full marketing width; `narrow` = article measure. */
  size?: "site" | "narrow";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 sm:px-6 lg:px-8 tv:px-24",
        size === "site" ? "max-w-[1320px] 2xl:max-w-[1440px] tv:max-w-[1920px]" : "max-w-[880px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
