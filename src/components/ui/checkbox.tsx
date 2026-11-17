"use client";

import * as React from "react";
import { CheckIcon, MinusIcon } from "lucide-react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";

import { cn } from "@/components/ui/_utils";

/** Checkbox — docs/08 §6.2: 24px (WCAG 2.2 target size), unchecked `border-strong`, checked `accent` fill + `accent-fg`. */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative size-6 shrink-0 max-[769px]:-m-2 max-[769px]:size-10 max-[769px]:border-0 max-[769px]:bg-transparent max-[769px]:before:absolute max-[769px]:before:inset-2 max-[769px]:before:rounded-xs max-[769px]:before:border max-[769px]:before:border-border-strong max-[769px]:before:bg-surface max-[769px]:before:content-[''] max-[769px]:aria-invalid:before:border-danger max-[769px]:data-[state=checked]:bg-transparent max-[769px]:data-[state=checked]:before:border-accent max-[769px]:data-[state=checked]:before:bg-accent max-[769px]:data-[state=indeterminate]:bg-transparent max-[769px]:data-[state=indeterminate]:before:border-accent max-[769px]:data-[state=indeterminate]:before:bg-accent rounded-xs border border-border-strong bg-surface transition-[color,background-color,border-color,box-shadow] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-fg data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-accent-fg",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="relative grid place-content-center text-current transition-none"
      >
        {props.checked === "indeterminate" ? (
          <MinusIcon className="size-4" />
        ) : (
          <CheckIcon className="size-4" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
