/**
 * `cn()` — the shadcn class-name helper (clsx + tailwind-merge).
 * Lives under components/ui because `src/lib/**` is owned by P1.4; `components.json` points
 * the shadcn `utils` alias here so generated components import it unchanged.
 *
 * tailwind-merge must know the custom font-size tokens from `styles/tokens.css` (`--text-*`).
 * Otherwise `text-body` (size) and `text-accent-fg` (colour) look like the same group and the
 * colour class is dropped — which made primary buttons inherit the page foreground (P1.3 axe).
 */
import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/** Keep in sync with the `--text-*` font-size tokens in `src/styles/tokens.css`. */
export const FONT_SIZE_TOKENS = [
  "display-xl",
  "display-lg",
  "h1",
  "h2",
  "h3",
  "h4",
  "body-lg",
  "body",
  "body-sm",
  "caption",
  "overline",
  "mono",
  "price",
  "pullquote",
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: [...FONT_SIZE_TOKENS] }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
