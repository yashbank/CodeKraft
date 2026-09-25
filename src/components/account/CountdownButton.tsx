"use client";

import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * Resend-style button with a cooldown (SCR-AUTH-02/03/04/05). While cooling it is disabled and the
 * label reads "Resend in 42 s"; the remaining time is announced once, not per second.
 */
export function CountdownButton({
  seconds = 60,
  initialRemaining = 0,
  label,
  onClick,
  children: _children,
  ...props
}: Omit<ButtonProps, "onClick" | "children"> & {
  seconds?: number;
  /** Start already cooling (preview / after a server-side send). */
  initialRemaining?: number;
  label: string;
  onClick?: () => void;
  children?: never;
}) {
  const [remaining, setRemaining] = React.useState(initialRemaining);

  React.useEffect(() => {
    if (remaining <= 0) return;
    const t = window.setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => window.clearTimeout(t);
  }, [remaining]);

  const cooling = remaining > 0;
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        disabled={cooling}
        onClick={() => {
          onClick?.();
          setRemaining(seconds);
        }}
        {...props}
      >
        {cooling ? `Resend in ${remaining} s` : label}
      </Button>
      <span className="sr-only" aria-live="polite">
        {cooling ? `You can resend in ${remaining} seconds.` : ""}
      </span>
    </>
  );
}
