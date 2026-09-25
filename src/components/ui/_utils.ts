/**
 * `cn()` — the shadcn class-name helper (clsx + tailwind-merge).
 * Lives under components/ui because `src/lib/**` is owned by P1.4; `components.json` points
 * the shadcn `utils` alias here so generated components import it unchanged.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
