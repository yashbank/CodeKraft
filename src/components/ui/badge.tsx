import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/components/ui/_utils";
import type { Tone } from "@/lib/status-tone";

/**
 * Badge / status chip — shadcn new-york + docs/08 §6.8.
 * `tone` drives fill/text/dot from semantic tokens (neutral, accent, info, success, warning,
 * danger, ghost). The shadcn `variant` prop is kept for copied-in code; `tone` wins when set.
 * Height 24 (`sm` 20), 10px x-padding, caption 600, optional leading 6px dot.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent px-2.5 text-caption font-semibold whitespace-nowrap transition-[color,box-shadow] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&>svg]:pointer-events-none [&>svg]:size-3.5",
  {
    variants: {
      tone: {
        neutral: "bg-elevated text-fg-muted [&_[data-slot=badge-dot]]:bg-fg-subtle",
        accent: "bg-accent-soft text-accent-text [&_[data-slot=badge-dot]]:bg-accent",
        info: "bg-info-soft text-info [&_[data-slot=badge-dot]]:bg-info",
        success: "bg-success-soft text-success [&_[data-slot=badge-dot]]:bg-success",
        warning: "bg-warning-soft text-warning [&_[data-slot=badge-dot]]:bg-warning",
        danger: "bg-danger-soft text-danger [&_[data-slot=badge-dot]]:bg-danger",
        ghost: "border-border bg-transparent text-fg-subtle [&_[data-slot=badge-dot]]:hidden",
      },
      variant: {
        default: "bg-accent text-accent-fg [a&]:hover:bg-accent-hover",
        secondary: "bg-elevated text-fg [a&]:hover:bg-accent-soft",
        destructive: "bg-danger text-danger-fg [a&]:hover:bg-danger-solid",
        outline: "border-border text-fg [a&]:hover:bg-accent-soft [a&]:hover:text-accent-text",
        ghost: "[a&]:hover:bg-accent-soft [a&]:hover:text-accent-text",
        link: "text-accent-text underline-offset-4 [a&]:hover:underline",
      },
      size: {
        md: "h-6",
        sm: "h-5 px-2",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

type BadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    asChild?: boolean;
    /** Semantic tone (docs/08 §6.8); overrides `variant`. */
    tone?: Tone;
    /** Render the 6px leading dot (hidden for `ghost`). */
    dot?: boolean;
  };

function Badge({
  className,
  variant,
  tone,
  size = "md",
  dot = false,
  asChild = false,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot.Root : "span";
  const resolvedVariant = tone ? undefined : (variant ?? "default");

  return (
    <Comp
      data-slot="badge"
      data-tone={tone}
      data-variant={resolvedVariant}
      className={cn(badgeVariants({ tone, variant: resolvedVariant, size }), className)}
      {...props}
    >
      {dot && tone ? (
        <span data-slot="badge-dot" aria-hidden className="size-1.5 shrink-0 rounded-full" />
      ) : null}
      {children}
    </Comp>
  );
}

export { Badge, badgeVariants, type BadgeProps };
