import * as React from "react";

import { cn } from "@/components/ui/_utils";

/**
 * Input — shadcn new-york + docs/08 §6.2: 40px (44px on touch), `surface` fill, `border-input`,
 * placeholder `fg-subtle`, hover border `fg-subtle`, focus border `accent` + focus ring, error via
 * `aria-invalid` (border `danger`), disabled `canvas` fill + `fg-subtle`, read-only borderless.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-md border border-border-strong bg-surface px-3 py-1 text-body text-fg transition-[color,border-color,box-shadow] outline-none pointer-coarse:h-11 selection:bg-accent selection:text-accent-fg file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-body-sm file:font-medium file:text-fg placeholder:text-fg-subtle hover:border-fg-subtle disabled:pointer-events-none disabled:cursor-not-allowed disabled:border-border disabled:bg-canvas disabled:text-fg-subtle read-only:border-transparent read-only:bg-transparent read-only:text-fg-muted",
        "focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "aria-invalid:border-danger aria-invalid:focus-visible:outline-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
