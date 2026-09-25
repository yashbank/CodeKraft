"use client";

import { MoonStarIcon, SunIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/components/ui/_utils";
import { THEME_NAMES, type ThemeName } from "@/styles/motion";

const LABELS: Record<ThemeName, { label: string; Icon: typeof SunIcon }> = {
  "dark-cinematic": { label: "Cinematic", Icon: MoonStarIcon },
  "light-editorial": { label: "Editorial", Icon: SunIcon },
};

/**
 * Dev-only theme switcher: flips `document.documentElement.dataset.theme` between the two
 * theme sheets so the kitchen sink can be inspected in both. The production toggle
 * (`components/site/ThemeToggle`, docs/08 §10) also persists a cookie; this one does not.
 */
export function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeName>("dark-cinematic");

  useEffect(() => {
    const current = document.documentElement.dataset.theme;
    if (current === "light-editorial" || current === "dark-cinematic") setTheme(current);
  }, []);

  function apply(next: ThemeName) {
    document.documentElement.dataset.theme = next;
    setTheme(next);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex rounded-md border border-border bg-surface p-[3px]"
    >
      {THEME_NAMES.map((name) => {
        const { label, Icon } = LABELS[name];
        const active = theme === name;
        return (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={active}
            data-theme-option={name}
            onClick={() => apply(name)}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-sm px-3 text-body-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              active ? "bg-elevated text-fg shadow-1" : "text-fg-muted hover:text-fg",
            )}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
