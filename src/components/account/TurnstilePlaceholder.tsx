import { ShieldCheckIcon } from "lucide-react";

/**
 * Placeholder for the invisible Cloudflare Turnstile widget (D-1204). Public auth forms mount the
 * real widget here in Phase 7; the preview shows where the challenge state renders on failure.
 */
export function TurnstilePlaceholder({ failed = false }: { failed?: boolean }) {
  return (
    <div
      data-slot="turnstile"
      className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-caption text-fg-subtle"
    >
      <ShieldCheckIcon aria-hidden className="size-4" />
      {failed ? (
        <span role="alert" className="text-danger">
          We couldn&apos;t verify your browser — please try again.
        </span>
      ) : (
        <span>Protected by an invisible browser check.</span>
      )}
    </div>
  );
}
