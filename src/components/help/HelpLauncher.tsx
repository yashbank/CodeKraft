"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { MessageCircleQuestionIcon } from "lucide-react";

import { cn } from "@/components/ui/_utils";
import { DEFAULT_SUGGESTIONS } from "./suggestions";
import { strings } from "./strings";
import type { HelpRole, Suggestions } from "./types";

// Dialog content (thread, markdown, speech) loads on first open only.
const HelpPanel = dynamic(() => import("./HelpPanel"), { ssr: false });

export interface HelpLauncherProps {
  /** getHelpConfig().enabled; renders nothing when false. */
  helpEnabled?: boolean;
  /** getHelpConfig().hindi; shows the EN/HI switch. */
  hindiEnabled?: boolean;
  role?: HelpRole;
  suggestions?: Suggestions;
  /** Where the page already pins UI to the bottom edge. "tabbar" lifts the button above the mobile tab bar. */
  area?: "site" | "account" | "admin";
}

function typingTarget(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null;
  return !!n && (n.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName));
}

/**
 * Floating "Ask me anything" button + lazy-loaded dialog. Keyboard: "?" on the public site; the
 * account and admin areas already use "?" for their shortcut list, so there it is Alt+/.
 */
export function HelpLauncher({
  helpEnabled = true,
  hindiEnabled = false,
  role = "customer",
  suggestions = DEFAULT_SUGGESTIONS,
  area = "site",
}: HelpLauncherProps) {
  const [open, setOpen] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const btn = React.useRef<HTMLButtonElement>(null);
  const questionKey = area === "site";

  const show = React.useCallback(() => {
    setLoaded(true);
    setOpen(true);
  }, []);

  React.useEffect(() => {
    if (!helpEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      const hit = questionKey ? e.key === "?" && !e.altKey : e.altKey && e.code === "Slash";
      if (!hit || typingTarget(e.target)) return;
      e.preventDefault();
      show();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [helpEnabled, questionKey, show]);

  if (!helpEnabled) return null;
  const t = strings("en");
  const keyLabel = questionKey ? "?" : "Alt+/";

  return (
    <>
      <button
        ref={btn}
        type="button"
        data-help-launcher=""
        data-area={area}
        data-testid="help-launcher"
        aria-label={t.launcher}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-keyshortcuts={questionKey ? "?" : "Alt+/"}
        onClick={show}
        className={cn(
          "group fixed z-(--ck-z-header) grid size-14 place-items-center rounded-full bg-accent text-accent-fg shadow-glow transition-[transform,opacity,box-shadow] duration-(--ck-motion-duration-md) ease-emphasized print:hidden",
          "right-4 hover:scale-105 hover:bg-accent-hover hover:shadow-glow-hover active:scale-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas focus-visible:outline-none sm:right-5",
          area === "account"
            ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] lg:bottom-5"
            : "bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-5",
          open && "pointer-events-none scale-90 opacity-0",
        )}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full bg-accent motion-safe:animate-[ck-help-pulse_1800ms_ease-out_1.2s_2_both] motion-reduce:hidden"
        />
        <MessageCircleQuestionIcon aria-hidden className="relative size-6" />
        <span
          role="tooltip"
          aria-hidden
          className="pointer-events-none absolute right-full mr-3 hidden items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-caption font-medium whitespace-nowrap text-fg opacity-0 shadow-2 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 [@media(hover:hover)]:flex"
        >
          {t.launcher}
          <kbd className="rounded border border-border bg-elevated px-1.5 font-mono text-[11px] text-fg-muted">
            {keyLabel}
          </kbd>
        </span>
      </button>
      {loaded ? (
        <HelpPanel
          open={open}
          onOpenChange={setOpen}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            btn.current?.focus();
          }}
          role={role}
          hindi={hindiEnabled}
          suggestions={suggestions}
        />
      ) : null}
    </>
  );
}
