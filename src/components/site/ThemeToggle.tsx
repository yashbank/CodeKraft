"use client";

import { MonitorIcon, MoonStarIcon, SunIcon } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { applyThemePref, isThemePref, THEME_COOKIE, type ThemePref } from "@/lib/theme";
import { setThemePreference } from "@/modules/users/theme-actions";

const ORDER: ThemePref[] = ["dark-cinematic", "light-editorial", "auto"];
const WORD: Record<ThemePref, string> = {
  "dark-cinematic": "dark",
  "light-editorial": "light",
  auto: "auto",
};

/** Current choice: the ck_theme cookie (incl. "auto"), else whatever the page rendered with. */
function currentPref(): ThemePref {
  const c = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`))?.[1];
  if (isThemePref(c)) return c;
  return document.documentElement.dataset.theme === "light-editorial"
    ? "light-editorial"
    : "dark-cinematic";
}

/**
 * Visitor theme switch (docs/07 §4.2): dark → light → auto (system), shown when the admin enables
 * "visitors can switch theme". The choice lands in the ck_theme cookie and, for signed-in users,
 * on their profile (`setThemePreference`) so it follows them to account and admin.
 */
export function ThemeToggle({ enabled = false }: { enabled?: boolean }) {
  const [pref, setPref] = React.useState<ThemePref>("dark-cinematic");
  React.useEffect(() => setPref(currentPref()), []);
  if (!enabled) return null;

  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length]!;
  const label = `Switch to ${WORD[next]} theme`;
  const Icon = pref === "auto" ? MonitorIcon : pref === "light-editorial" ? SunIcon : MoonStarIcon;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      data-theme-pref={pref}
      onClick={() => {
        applyThemePref(next);
        setPref(next);
        void setThemePreference(next);
      }}
    >
      <Icon aria-hidden />
    </Button>
  );
}
