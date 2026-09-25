"use client";

import * as React from "react";
import { Label as LabelPrimitive } from "radix-ui";

import { cn } from "@/components/ui/_utils";

/**
 * Label — docs/08 §6.2: `body-sm` 600 `fg`. `required` renders the `danger` asterisk (pair it with
 * `aria-required` / `required` on the control); optional fields say "(optional)" in the label text.
 */
function Label({
  className,
  required = false,
  children,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> & { required?: boolean }) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        "flex items-center gap-1.5 text-body-sm leading-none font-semibold text-fg select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      {required ? (
        <span aria-hidden data-slot="label-required" className="text-danger">
          *
        </span>
      ) : null}
    </LabelPrimitive.Root>
  );
}

export { Label };
