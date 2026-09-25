import { Button, type ButtonProps } from "@/components/ui/button";

function GoogleGlyph() {
  // Brand glyph drawn in currentColor so it follows the theme (no colour literals).
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <path d="M21.6 12.23c0-.68-.06-1.33-.17-1.96H12v3.71h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.27Z" />
      <path d="M12 21.6c2.7 0 4.96-.9 6.62-2.42l-3.24-2.5c-.9.6-2.04.96-3.38.96-2.6 0-4.8-1.75-5.58-4.1H3.07v2.58A9.99 9.99 0 0 0 12 21.6Z" />
      <path d="M6.42 13.54a6.02 6.02 0 0 1 0-3.84V7.12H3.07a10 10 0 0 0 0 8.96l3.35-2.54Z" />
      <path d="M12 6.36c1.47 0 2.78.5 3.82 1.5l2.86-2.87A9.98 9.98 0 0 0 12 2.4a9.99 9.99 0 0 0-8.93 5.52l3.35 2.58C7.2 8.14 9.4 6.36 12 6.36Z" />
    </svg>
  );
}

/** "Continue with Google" — full width, Google glyph, accessible name is the label (SCR-AUTH-01). */
export function GoogleButton({
  label = "Continue with Google",
  ...props
}: ButtonProps & { label?: string }) {
  return (
    <Button type="button" variant="secondary" size="lg" className="w-full" {...props}>
      <GoogleGlyph />
      {label}
    </Button>
  );
}
