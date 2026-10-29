"use client";

import * as React from "react";

import { applyThemePref, isThemePref, THEME_COOKIE, type ThemePref } from "@/lib/theme";
import { setThemePreference } from "@/modules/users/theme-actions";

/**
 * Rendered by the dynamic (signed-in) layouts. A saved profile choice wins over this browser's
 * cookie, so it applies on every host (site, account, admin); a signed-in user with no saved
 * choice adopts the one they made before logging in.
 */
export function ThemeSync({ pref }: { pref: ThemePref | null }) {
  React.useEffect(() => {
    const c = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`))?.[1];
    if (pref) {
      if (c !== pref) applyThemePref(pref);
    } else if (isThemePref(c)) {
      void setThemePreference(c);
    }
  }, [pref]);
  return null;
}
