"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button, type ButtonProps } from "@/components/ui/button";

/** Copies `value` to the clipboard, shows a "Copied" toast (docs/08 §6.15) and a brief check icon. */
export function CopyButton({
  value,
  label,
  size = "icon-sm",
  variant = "ghost",
  ...props
}: Omit<ButtonProps, "onClick" | "children"> & { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copied", { description: label });
          window.setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy — select the text and copy it manually.");
        }
      }}
      {...props}
    >
      {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
    </Button>
  );
}
