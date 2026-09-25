"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/components/ui/_utils";
import { Input } from "@/components/ui/input";

/**
 * Password field with a show/hide toggle (`aria-pressed`) and a Caps-lock warning (SCR-AUTH-01).
 * The toggle's accessible name is "Show"/"Hide" (not "…password") so label queries for the field
 * stay unambiguous.
 */
export function PasswordInput({
  className,
  id,
  onKeyUp,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = React.useState(false);
  const [capsLock, setCapsLock] = React.useState(false);
  const capsId = id ? `${id}-capslock` : undefined;
  return (
    <div className="space-y-1.5">
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          className={cn("pr-20", className)}
          onKeyUp={(e) => {
            setCapsLock(e.getModifierState("CapsLock"));
            onKeyUp?.(e);
          }}
          {...props}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-controls={id}
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-1 right-1 inline-flex items-center gap-1 rounded-sm px-2 text-body-sm font-medium text-fg-muted hover:bg-accent-soft hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {visible ? (
            <EyeOffIcon aria-hidden className="size-4" />
          ) : (
            <EyeIcon aria-hidden className="size-4" />
          )}
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {capsLock ? (
        <p id={capsId} className="text-caption text-warning" aria-live="polite">
          Caps lock is on.
        </p>
      ) : null}
    </div>
  );
}
