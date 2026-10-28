"use client";

import { MoonStarIcon, SunIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { THEME_COOKIE, type ThemeName } from "@/lib/theme";

/** Visitor theme switch (docs/07 §4.2), shown when the admin enables "visitors can switch theme". */
export function ThemeToggle({ enabled = false }: { enabled?: boolean }) {
  const [theme, setTheme] = React.useState<ThemeName>("dark-cinematic");
  React.useEffect(() => {
    if (document.documentElement.dataset.theme === "light-editorial") setTheme("light-editorial");
  }, []);
  if (!enabled) return null;

  const next: ThemeName = theme === "light-editorial" ? "dark-cinematic" : "light-editorial";
  const label = `Switch to ${next === "light-editorial" ? "light" : "dark"} theme`;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        setTheme(next);
      }}
    >
      {theme === "light-editorial" ? <MoonStarIcon aria-hidden /> : <SunIcon aria-hidden />}
    </Button>
  );
}
