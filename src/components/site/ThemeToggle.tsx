import { MoonStarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Theme toggle placeholder (docs/07 §4.2). Rendered only when the `theme_light_editorial`
 * flag is on (release 1: off). P7 wires the cookie/user-pref persistence; the props-only shell
 * exists so header/footer layouts already reserve the slot.
 */
export function ThemeToggle({ enabled = false }: { enabled?: boolean }) {
  if (!enabled) return null;
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Theme: Dark cinematic"
      title="Theme: Dark cinematic"
    >
      <MoonStarIcon aria-hidden />
    </Button>
  );
}
