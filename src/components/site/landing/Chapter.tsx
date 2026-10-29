import type { ReactNode } from "react";

import { cn } from "@/components/ui/_utils";

import { sectionStyleCss, type SectionStyle } from "@/modules/content/section-style";

import { Container } from "../Container";

/**
 * Story chapter section (docs/08 §6.6): `min-height: 100svh` at lg+, chapter number overline,
 * display-lg title, body ≤ 55ch, media slot. Plain stacked section — no scroll-snap, no wheel
 * capture (docs/07 §7). GSAP pin-with-spacing at lg+ is the P7 `components/motion/Chapter`.
 */
export function Chapter({
  id,
  eyebrow,
  title,
  body,
  children,
  layout = "stack",
  className,
  style,
}: {
  id: string;
  eyebrow: string;
  title: string;
  body?: string;
  children?: ReactNode;
  /** `split` = sticky copy column + media column at lg. */
  layout?: "stack" | "split";
  className?: string;
  /** Admin per-section look; absent = renders exactly as before. */
  style?: SectionStyle;
}) {
  const headingId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("scroll-mt-16 py-16 lg:flex lg:min-h-svh lg:items-center lg:py-24", className)}
      style={sectionStyleCss(style)}
    >
      <Container
        className={cn("w-full", layout === "split" && "lg:grid lg:grid-cols-12 lg:gap-12")}
      >
        <div
          className={cn(
            style?.gap ? "flex flex-col gap-[var(--sec-gap)]" : "space-y-4",
            layout === "split" ? "lg:sticky lg:top-28 lg:col-span-5 lg:self-start" : "max-w-3xl",
          )}
        >
          <p className="text-overline font-semibold tracking-wider text-accent-text uppercase">
            {eyebrow}
          </p>
          <h2 id={headingId} className="font-display text-display-lg text-balance text-fg">
            {title}
          </h2>
          {body ? <p className="max-w-[55ch] text-body-lg text-fg-muted">{body}</p> : null}
        </div>
        <div
          className={cn(
            style?.gap ? "mt-[var(--sec-gap)]" : "mt-10",
            layout === "split" ? "lg:col-span-7 lg:mt-0" : !style?.gap && "lg:mt-14",
          )}
        >
          {children}
        </div>
      </Container>
    </section>
  );
}
