import { cn } from "./_utils";

/** "X is typing" with animated dots; polite live region, dots stand still under reduced motion. */
export function TypingIndicator({
  label = "Assistant is typing",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="typing-indicator"
      className={cn("flex items-center gap-2 text-caption text-fg-muted", className)}
    >
      <span aria-hidden className="flex gap-1">
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            style={{ animationDelay: `${d}ms` }}
            className="size-1.5 rounded-full bg-fg-subtle motion-safe:animate-bounce"
          />
        ))}
      </span>
      {label}
    </div>
  );
}
