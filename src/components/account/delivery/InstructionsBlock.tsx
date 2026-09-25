import { PaperclipIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Post-purchase instructions (offering `instructions_json`) + optional signed attachments. */
export function InstructionsBlock({
  paragraphs,
  attachments = [],
  title = "Instructions",
}: {
  paragraphs: string[];
  attachments?: { name: string; sizeLabel: string }[];
  title?: string;
}) {
  if (paragraphs.length === 0 && attachments.length === 0) return null;
  return (
    <section
      aria-label={title}
      className="space-y-3 rounded-lg border border-border bg-surface p-4"
    >
      <h2 className="text-body font-semibold text-fg">{title}</h2>
      <div className="space-y-2 text-body-sm text-fg-muted">
        {paragraphs.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      {attachments.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {attachments.map((a) => (
            <li key={a.name}>
              <Button variant="outline" size="sm">
                <PaperclipIcon aria-hidden /> {a.name}
                <span className="text-fg-subtle">· {a.sizeLabel}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
