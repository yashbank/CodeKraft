"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Banner } from "../Banner";
import { Field, RichTextField } from "../RichTextField";
import type { LandingChapter, ServiceRow } from "../types";
import { ContentEditorFrame, moveItem, SortableRow } from "./ContentEditorFrame";

const CHAPTER_LABEL: Record<LandingChapter["key"], string> = {
  who: "Who we are",
  build: "What we build",
  sell: "What we sell",
  proof: "Proof",
  talk: "Talk to us",
};
const TARGETS = ["/products", "/services", "/projects", "/contact", "inquiry", "URL…"];

export interface LandingEditorProps {
  chapters: LandingChapter[];
  services: ServiceRow[];
  publishedProducts: string[];
  featured: string[];
  canPublish: boolean;
}

/** SCR-ADM-23 — five story chapters with a rail, per-chapter form and chapter-specific blocks (featured products, services, proof). */
export function LandingEditor({
  chapters,
  services,
  publishedProducts,
  featured: initialFeatured,
  canPublish,
}: LandingEditorProps) {
  const [active, setActive] = React.useState<LandingChapter["key"]>("who");
  const [featured, setFeatured] = React.useState(initialFeatured);
  const chapter = chapters.find((c) => c.key === active) ?? chapters[0];
  if (!chapter) return null;
  const rail = chapters.map((c) => ({
    key: c.key,
    label: CHAPTER_LABEL[c.key],
    meta: c.published ? "Published" : "Draft",
    badge: (
      <Badge tone={c.published ? "success" : "neutral"} size="sm">
        {c.published ? "on" : "off"}
      </Badge>
    ),
  }));

  return (
    <ContentEditorFrame
      title="Landing page"
      description="Five story chapters. Changes revalidate the landing page on save."
      rail={rail}
      railLabel="Chapters"
      active={active}
      onSelect={(k) => setActive(k as LandingChapter["key"])}
      previewHref="/?preview=draft"
    >
      <form className="space-y-5" onSubmit={(e) => e.preventDefault()} key={chapter.key}>
        <h2 className="text-h3">
          {CHAPTER_LABEL[chapter.key]}{" "}
          <span className="font-mono text-caption text-fg-muted">
            position {chapters.indexOf(chapter) + 1} · read-only
          </span>
        </h2>
        <Field
          id="ch-title"
          label="Title"
          required
          hint={
            chapter.key === "who"
              ? "Keep the hero title under 60 characters for the 3D scene layout."
              : undefined
          }
        >
          <Input
            id="ch-title"
            defaultValue={chapter.title}
            maxLength={chapter.key === "who" ? 60 : undefined}
          />
        </Field>
        <Field id="ch-subtitle" label="Subtitle" optional>
          <Input id="ch-subtitle" defaultValue={chapter.subtitle} />
        </Field>
        <RichTextField id="ch-body" label="Body" defaultValue={chapter.body} rows={4} />
        {chapter.key === "who" ? (
          <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <h3 className="text-h4">Hero media</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="ch-poster"
                label="Poster image"
                required
                hint="Alt text is required — it also serves as the poster description for screen readers."
              >
                <Input id="ch-poster" readOnly value={chapter.poster ?? ""} className="font-mono" />
              </Field>
              <Field id="ch-poster-alt" label="Alt text" required>
                <Input
                  id="ch-poster-alt"
                  defaultValue="Abstract violet product interface floating on a dark canvas"
                />
              </Field>
            </div>
            <Banner tone="neutral">
              The 3D scene is code-driven; the poster is the fallback and the mobile hero. No
              founder names or photos (D-103).
            </Banner>
          </div>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ch-cta1" label="Primary CTA label">
            <Input id="ch-cta1" defaultValue={chapter.ctaPrimary?.label ?? "Start a project"} />
          </Field>
          <Field id="ch-cta1-target" label="Primary CTA target">
            <Select defaultValue={chapter.ctaPrimary?.target ?? "inquiry"}>
              <SelectTrigger id="ch-cta1-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGETS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t === "inquiry" ? "Project inquiry sheet" : t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="ch-cta2" label="Secondary CTA label" optional>
            <Input id="ch-cta2" defaultValue={chapter.ctaSecondary?.label ?? ""} />
          </Field>
          <Field id="ch-cta2-target" label="Secondary CTA target" optional>
            <Select defaultValue={chapter.ctaSecondary?.target ?? "/products"}>
              <SelectTrigger id="ch-cta2-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGETS.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t === "inquiry" ? "Project inquiry sheet" : t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {chapter.key === "build" ? (
          <div className="space-y-2 rounded-lg border border-border bg-surface p-4">
            <h3 className="text-h4">
              Services to highlight{" "}
              <span className="text-caption font-normal text-fg-muted">(max 8, ordered)</span>
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {services.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <Switch id={`svc-${s.id}`} size="sm" defaultChecked={s.published} />
                  <Label htmlFor={`svc-${s.id}`}>{s.title}</Label>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {chapter.key === "sell" ? (
          <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <h3 className="text-h4">
              Featured products{" "}
              <span className="text-caption font-normal text-fg-muted">
                (max 8, published only)
              </span>
            </h3>
            <ol className="space-y-2">
              {featured.map((p, i) => (
                <SortableRow
                  key={p}
                  index={i}
                  total={featured.length}
                  label={p}
                  onMove={(f, t) => setFeatured((l) => moveItem(l, f, t))}
                >
                  <span className="flex items-center justify-between gap-2 text-body-sm">
                    {p}
                    <button
                      type="button"
                      className="text-caption text-danger hover:underline"
                      onClick={() => setFeatured((l) => l.filter((x) => x !== p))}
                    >
                      Remove
                    </button>
                  </span>
                </SortableRow>
              ))}
            </ol>
            <Field
              id="ch-add-featured"
              label="Add product"
              hint="Unlisted products are excluded (D-314). Fallback: latest published."
            >
              <Select
                onValueChange={(v) =>
                  setFeatured((l) => (l.includes(v) || l.length >= 8 ? l : [...l, v]))
                }
              >
                <SelectTrigger id="ch-add-featured">
                  <SelectValue placeholder="Choose a published product" />
                </SelectTrigger>
                <SelectContent>
                  {publishedProducts
                    .filter((p) => !featured.includes(p))
                    .map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : null}
        {chapter.key === "proof" ? (
          <div className="space-y-4 rounded-lg border border-border bg-surface p-4">
            <h3 className="text-h4">Proof blocks</h3>
            <div className="flex items-center gap-2">
              <Switch id="proof-logos" defaultChecked />
              <Label htmlFor="proof-logos">Show all published logos</Label>
            </div>
            <Field id="proof-cs" label="Case studies">
              <Select defaultValue="latest3">
                <SelectTrigger id="proof-cs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest3">Latest 3</SelectItem>
                  <SelectItem value="pick">Pick…</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field id="proof-testimonials" label="Site testimonials (up to 3)">
              <Input id="proof-testimonials" defaultValue="Global Textiles, Nimbus Retail" />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-body-sm font-semibold">Stat tiles (up to 3)</legend>
              {[
                ["Products shipped", "12"],
                ["Client projects", "38"],
                ["Avg. response", "< 1 business day"],
              ].map(([label, value], i) => (
                <div key={label} className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor={`stat-l-${i}`} className="sr-only">
                      Stat {i + 1} label
                    </Label>
                    <Input
                      id={`stat-l-${i}`}
                      defaultValue={label}
                      placeholder="Label"
                      className="h-8"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`stat-v-${i}`} className="sr-only">
                      Stat {i + 1} value
                    </Label>
                    <Input
                      id={`stat-v-${i}`}
                      defaultValue={value}
                      placeholder="Value"
                      className="h-8"
                    />
                  </div>
                </div>
              ))}
            </fieldset>
          </div>
        ) : null}
        {chapter.key === "talk" ? (
          <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <h3 className="text-h4">Inquiry form copy</h3>
            <Field id="talk-intro" label="Form intro">
              <Input
                id="talk-intro"
                defaultValue="Tell us about the project; we reply within one business day."
              />
            </Field>
            <Field id="talk-success" label="Success copy">
              <Input
                id="talk-success"
                defaultValue="Thanks — we'll be in touch within one business day."
              />
            </Field>
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <Switch id="ch-published" defaultChecked={chapter.published} disabled={!canPublish} />
          <Label htmlFor="ch-published">Published</Label>
          {!canPublish ? (
            <span className="text-caption text-fg-muted">Requires content.publish</span>
          ) : null}
        </div>
      </form>
    </ContentEditorFrame>
  );
}
