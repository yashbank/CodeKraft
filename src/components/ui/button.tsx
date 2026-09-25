import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2Icon } from "lucide-react";
import { Slot } from "radix-ui";

import { cn } from "@/components/ui/_utils";

/**
 * Button — shadcn new-york + docs/08 §6.1 variants/sizes.
 * Variants: primary (shadcn `default` alias), secondary, outline, ghost, link, destructive
 * (`danger` alias), gradient (landing only, max one per page).
 * Sizes: sm 32 / md 40 (`default` alias) / lg 48 / xl 56 (landing) / icon-sm|md|lg (`icon` alias).
 * States: `disabled` opacity .5 + not-allowed; `loading` keeps the label, swaps the leading icon
 * for a spinner and sets aria-busy.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-(--ck-motion-duration-sm) ease-standard outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-busy:cursor-progress aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-accent-fg hover:bg-accent-hover hover:shadow-glow active:scale-[0.98]",
        default:
          "bg-accent text-accent-fg hover:bg-accent-hover hover:shadow-glow active:scale-[0.98]",
        secondary:
          "border border-border-strong bg-elevated text-fg hover:border-accent hover:text-accent-text active:scale-[0.98]",
        outline:
          "border border-border-strong bg-transparent text-fg hover:bg-accent-soft hover:text-accent-text",
        ghost: "bg-transparent text-fg-muted hover:bg-accent-soft hover:text-fg",
        link: "h-auto rounded-none bg-transparent p-0 text-accent-text underline-offset-4 hover:text-accent-hover hover:underline",
        destructive:
          "bg-danger text-danger-fg hover:bg-danger-solid hover:text-destructive-foreground",
        danger: "bg-danger text-danger-fg hover:bg-danger-solid hover:text-destructive-foreground",
        gradient:
          "bg-[image:var(--ck-gradient-brand)] text-inverse-fg hover:shadow-glow-hover active:scale-[0.98]",
      },
      size: {
        sm: "h-8 px-3 text-body-sm [&_svg:not([class*='size-'])]:size-4",
        md: "h-10 px-4 text-body",
        default: "h-10 px-4 text-body",
        lg: "h-12 px-5 text-body",
        xl: "h-14 rounded-lg px-7 text-body-lg",
        "icon-sm": "size-8 [&_svg:not([class*='size-'])]:size-4",
        "icon-md": "size-10",
        icon: "size-10",
        "icon-lg": "size-12",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Keeps the label, replaces the leading icon with a spinner, sets `aria-busy`. */
    loading?: boolean;
  };

function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-loading={loading ? "true" : undefined}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {loading ? (
        <>
          <Loader2Icon aria-hidden className="size-4 animate-spin" />
          {children}
        </>
      ) : (
        children
      )}
    </Comp>
  );
}

export { Button, buttonVariants, type ButtonProps };
