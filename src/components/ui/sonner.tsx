"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toaster — docs/08 §6.9. Colours come from the `[data-theme]` tokens (no `next-themes`: the
 * theme is an attribute, never a React context — docs/08 §4.5). 360px, `elevated` + `shadow-3`
 * + hairline, `radius-lg`, 4px left rule in tone colour, max 3 stacked, bottom-right on `lg+`
 * and top-centre on phones (pass `position` to override). Durations: 5 s success/info, 8 s
 * warning, danger persists until closed (use `toast.error(msg, { duration: Infinity })`).
 */
const Toaster = ({ toastOptions, ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      visibleToasts={3}
      closeButton
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--ck-color-elevated)",
          "--normal-text": "var(--ck-color-fg)",
          "--normal-border": "var(--ck-color-border)",
          "--success-bg": "var(--ck-color-elevated)",
          "--success-text": "var(--ck-color-fg)",
          "--success-border": "var(--ck-color-border)",
          "--info-bg": "var(--ck-color-elevated)",
          "--info-text": "var(--ck-color-fg)",
          "--info-border": "var(--ck-color-border)",
          "--warning-bg": "var(--ck-color-elevated)",
          "--warning-text": "var(--ck-color-fg)",
          "--warning-border": "var(--ck-color-border)",
          "--error-bg": "var(--ck-color-elevated)",
          "--error-text": "var(--ck-color-fg)",
          "--error-border": "var(--ck-color-border)",
          "--border-radius": "var(--ck-radius-lg)",
          "--width": "360px",
        } as React.CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        classNames: {
          toast:
            "group toast !border-l-4 !shadow-3 data-[type=success]:!border-l-success data-[type=info]:!border-l-info data-[type=warning]:!border-l-warning data-[type=error]:!border-l-danger data-[type=loading]:!border-l-accent data-[type=default]:!border-l-accent",
          title: "text-body-sm font-semibold text-fg",
          description: "text-body-sm text-fg-muted",
          icon: "data-[type=success]:text-success data-[type=info]:text-info data-[type=warning]:text-warning data-[type=error]:text-danger",
          actionButton: "!bg-accent !text-accent-fg",
          cancelButton: "!bg-elevated !text-fg-muted",
          closeButton: "!border-border !bg-elevated !text-fg-muted",
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
