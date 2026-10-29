"use client";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Chapter } from "@/components/site/landing/Chapter";
import {
  FONT_IDS,
  FONT_LABELS,
  SCALE,
  SECTION_BORDERS,
  SECTION_TONES,
  type SectionStyle,
} from "@/modules/content/section-style";

import { Field } from "../RichTextField";

const DEF = "default";
const SIZE_LABEL: Record<string, string> = {
  xs: "Extra small",
  sm: "Small",
  md: "Medium",
  lg: "Large",
  xl: "Extra large",
};
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Key = keyof SectionStyle;
const CONTROLS: {
  key: Key;
  label: string;
  options: readonly string[];
  names?: Record<string, string>;
}[] = [
  { key: "font", label: "Font pairing", options: FONT_IDS, names: FONT_LABELS },
  { key: "border", label: "Border (top and bottom)", options: SECTION_BORDERS },
  { key: "padY", label: "Padding, vertical", options: SCALE, names: SIZE_LABEL },
  { key: "padX", label: "Padding, horizontal", options: SCALE, names: SIZE_LABEL },
  { key: "gap", label: "Spacing between elements", options: SCALE, names: SIZE_LABEL },
  { key: "tone", label: "Background tone", options: SECTION_TONES },
];

/** Read the style back out of the form: only non-default selects are kept. */
export function readSectionStyle(data: FormData): SectionStyle | undefined {
  const out: Record<string, string> = {};
  for (const c of CONTROLS) {
    const v = String(data.get(`style-${c.key}`) ?? DEF);
    if (v !== DEF) out[c.key] = v;
  }
  return Object.keys(out).length ? (out as SectionStyle) : undefined;
}

/** Per-section style controls + a live preview that renders the real public `Chapter`. */
export function SectionStylePanel({
  initial,
  eyebrow,
  title,
  help,
}: {
  initial?: SectionStyle;
  eyebrow?: string;
  title: string;
  help: string;
}) {
  const [style, setStyle] = React.useState<SectionStyle>(initial ?? {});
  const set = (k: Key, v: string) =>
    setStyle((s) => ({ ...s, [k]: v === DEF ? undefined : v }) as SectionStyle);
  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div>
        <h3 className="text-h4">Section style</h3>
        <p className="text-caption text-fg-muted">{help}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONTROLS.map((c) => (
          <Field key={c.key} id={`style-${c.key}`} label={c.label}>
            <Select
              name={`style-${c.key}`}
              value={style[c.key] ?? DEF}
              onValueChange={(v) => set(c.key, v)}
            >
              <SelectTrigger id={`style-${c.key}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value={DEF}>Default</SelectItem>
                {c.options
                  .filter((o) => o !== DEF)
                  .map((o) => (
                    <SelectItem key={o} value={o}>
                      {c.names?.[o] ?? cap(o)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
        ))}
      </div>
      <div
        data-testid="section-style-preview"
        className="overflow-hidden rounded-md border border-dashed border-border-strong bg-canvas"
      >
        <Chapter
          id="style-preview"
          eyebrow={eyebrow || "Eyebrow"}
          title={title || "Section title"}
          body="Live preview of this section's look. Save to publish it."
          style={style}
          className="lg:min-h-0"
        >
          <div className="rounded-md border border-border p-4 text-body-sm text-fg-muted">
            Section content
          </div>
        </Chapter>
      </div>
    </div>
  );
}
