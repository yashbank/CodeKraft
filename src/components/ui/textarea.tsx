import * as React from "react";

import { cn } from "@/components/ui/_utils";

/** Textarea — same tokens/states as `Input` (docs/08 §6.2). */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-md border border-border-strong bg-surface px-3 py-2 text-body text-fg transition-[color,border-color,box-shadow] outline-none placeholder:text-fg-subtle hover:border-fg-subtle focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:border-border disabled:bg-canvas disabled:text-fg-subtle read-only:border-transparent read-only:bg-transparent read-only:text-fg-muted aria-invalid:border-danger aria-invalid:focus-visible:outline-danger",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
