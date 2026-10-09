"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Field, RichTextField } from "../RichTextField";
import type { LandingChapter, ServiceRow } from "../types";
import { ContentEditorFrame, moveItem, SortableRow } from "./ContentEditorFrame";
import { fromPlainText } from "@/modules/content/render";
import { saveFeaturedProducts, saveLandingChapter } from "@/modules/content/admin-mutations";

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
  publishedProducts: { id: string; name: string }[];
  featuredIds: string[];
  canPublish: boolean;
}

/** SCR-ADM-23 — five story chapters with a rail, per-chapter form and chapter-specific blocks (featured products, services, proof). */
export function LandingEditor({
  chapters,
  services,
  publishedProducts,
  featuredIds: initialFeaturedIds,
  canPublish,
}: LandingEditorProps) {
  const router = useRouter();
  const [active, setActive] = React.useState<LandingChapter["key"]>(chapters[0]?.key ?? "who");
  const [featuredIds, setFeaturedIds] = React.useState(initialFeaturedIds);
  const [published, setPublished] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const posterFileInputRef = React.useRef<HTMLInputElement>(null);
  const chapter = chapters.find((c) => c.key === active) ?? chapters[0];
  const [pendingPosterMediaId, setPendingPosterMediaId] = React.useState<string | undefined>();
  const [pendingPosterPreview, setPendingPosterPreview] = React.useState<string | undefined>();
  const [uploadingPoster, setUploadingPoster] = React.useState(false);

  React.useEffect(() => {
    setPublished(chapter?.published ?? false);
    setPendingPosterMediaId(undefined);
    setPendingPosterPreview(undefined);
  }, [chapter?.key, chapter?.published]);

  async function handlePosterChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPoster(true);
    try {
      const { uploadMediaFile } = await import("@/lib/admin/media-upload");
      const uploaded = await uploadMediaFile(file, "content_media");
      setPendingPosterMediaId(uploaded.mediaId);
      setPendingPosterPreview(uploaded.url ?? URL.createObjectURL(file));
      toast.success("Image uploaded — save the chapter to apply it");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingPoster(false);
    }
  }

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

  async function handleSave() {
    if (!chapter) return;
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const result = await saveLandingChapter({
      key: chapter.key,
      eyebrow: String(data.get("eyebrow") ?? "").trim() || undefined,
      title: String(data.get("title") ?? "").trim(),
      subtitle: String(data.get("subtitle") ?? "").trim() || undefined,
      bodyJson: fromPlainText(String(data.get("body") ?? "")),
      media: { posterMediaId: pendingPosterMediaId ?? chapter.posterMediaId },
      cta: {
        primary: {
          label: String(data.get("cta1") ?? "").trim() || "Start a project",
          href: normalizeTarget(String(data.get("cta1-target") ?? "inquiry")),
        },
        ...(String(data.get("cta2") ?? "").trim()
          ? {
              secondary: {
                label: String(data.get("cta2") ?? "").trim(),
                href: normalizeTarget(String(data.get("cta2-target") ?? "/products")),
              },
            }
          : {}),
      },
      position: chapters.indexOf(chapter),
      published: canPublish ? published : chapter.published,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Chapter saved — landing page revalidated");
    router.refresh();
  }

  async function persistFeatured(ids: string[]) {
    setFeaturedIds(ids);
    const result = await saveFeaturedProducts({ productIds: ids });
    if (!result.ok) toast.error(result.error.message);
    else router.refresh();
  }

  const featuredNames = featuredIds
    .map((id) => publishedProducts.find((p) => p.id === id))
    .filter((p): p is { id: string; name: string } => Boolean(p));

  return (
    <ContentEditorFrame
      title="Landing page"
      description="Five story chapters. Changes revalidate the landing page on save."
      rail={rail}
      railLabel="Chapters"
      active={active}
      onSelect={(k) => setActive(k as LandingChapter["key"])}
      previewHref="/?preview=draft"
      onSave={handleSave}
    >
      <form
        ref={formRef}
        className="space-y-5"
        onSubmit={(e) => e.preventDefault()}
        key={chapter.key}
      >
        <h2 className="text-h3">
          {CHAPTER_LABEL[chapter.key]}{" "}
          <span className="font-mono text-caption text-fg-muted">
            position {chapters.indexOf(chapter) + 1}
          </span>
        </h2>
        <Field
          id="ch-poster"
          label="Hero image"
          optional
          hint={
            chapter.key === "who"
              ? "Shown behind the opening hero text on the public site."
              : 'Saved with this chapter, but not shown on the public page yet — only the "Who we are" hero image renders today.'
          }
        >
          <input
            ref={posterFileInputRef}
            type="file"
            className="sr-only"
            accept="image/*"
            onChange={handlePosterChosen}
          />
          <div className="flex items-center gap-3">
            {(pendingPosterPreview ?? chapter.poster) ? (
              // eslint-disable-next-line @next/next/no-img-element -- admin preview of a user-uploaded R2 URL, not a next/image-optimizable static asset
              <img
                src={pendingPosterPreview ?? chapter.poster}
                alt=""
                className="h-16 w-28 rounded-md border border-border object-cover"
              />
            ) : (
              <div className="grid h-16 w-28 place-items-center rounded-md border border-dashed border-border-strong text-caption text-fg-subtle">
                No image
              </div>
            )}
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={uploadingPoster}
              onClick={() => posterFileInputRef.current?.click()}
            >
              {chapter.poster || pendingPosterPreview ? "Replace image" : "Upload image"}
            </Button>
          </div>
        </Field>
        <Field
          id="ch-eyebrow"
          label="Eyebrow"
          optional
          hint="Small label above the title. 60 chars."
        >
          <Input id="ch-eyebrow" name="eyebrow" maxLength={60} defaultValue={chapter.eyebrow} />
        </Field>
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
            name="title"
            defaultValue={chapter.title}
            maxLength={chapter.key === "who" ? 60 : undefined}
            required
          />
        </Field>
        <Field id="ch-subtitle" label="Subtitle" optional>
          <Input id="ch-subtitle" name="subtitle" defaultValue={chapter.subtitle} />
        </Field>
        <RichTextField id="ch-body" name="body" label="Body" defaultValue={chapter.body} rows={4} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="ch-cta1" label="Primary CTA label">
            <Input
              id="ch-cta1"
              name="cta1"
              defaultValue={chapter.ctaPrimary?.label ?? "Start a project"}
            />
          </Field>
          <Field id="ch-cta1-target" label="Primary CTA target">
            <Select name="cta1-target" defaultValue={chapter.ctaPrimary?.target ?? "inquiry"}>
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
            <Input id="ch-cta2" name="cta2" defaultValue={chapter.ctaSecondary?.label ?? ""} />
          </Field>
          <Field id="ch-cta2-target" label="Secondary CTA target" optional>
            <Select name="cta2-target" defaultValue={chapter.ctaSecondary?.target ?? "/products"}>
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
            <h3 className="text-h4">Services shown here</h3>
            <p className="text-caption text-fg-muted">
              Every published service appears automatically. Manage publish state from the Services
              editor.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {services.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <Switch id={`svc-${s.id}`} size="sm" checked={s.published} disabled />
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
              {featuredNames.map((p, i) => (
                <SortableRow
                  key={p.id}
                  index={i}
                  total={featuredNames.length}
                  label={p.name}
                  onMove={(f, t) => persistFeatured(moveItem(featuredIds, f, t))}
                >
                  <span className="flex items-center justify-between gap-2 text-body-sm">
                    {p.name}
                    <button
                      type="button"
                      className="text-caption text-danger hover:underline"
                      onClick={() => persistFeatured(featuredIds.filter((id) => id !== p.id))}
                    >
                      Remove
                    </button>
                  </span>
                </SortableRow>
              ))}
              {featuredNames.length === 0 ? (
                <p className="text-body-sm text-fg-muted">No featured products yet.</p>
              ) : null}
            </ol>
            <Field
              id="ch-add-featured"
              label="Add product"
              hint="Unlisted products are excluded (D-314)."
            >
              <Select
                onValueChange={(v) => {
                  if (!featuredIds.includes(v) && featuredIds.length < 8)
                    persistFeatured([...featuredIds, v]);
                }}
              >
                <SelectTrigger id="ch-add-featured">
                  <SelectValue placeholder="Choose a published product" />
                </SelectTrigger>
                <SelectContent>
                  {publishedProducts
                    .filter((p) => !featuredIds.includes(p.id))
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <Switch
            id="ch-published"
            checked={published}
            onCheckedChange={setPublished}
            disabled={!canPublish}
          />
          <Label htmlFor="ch-published">Published</Label>
          {!canPublish ? (
            <span className="text-caption text-fg-muted">Requires content.publish</span>
          ) : null}
        </div>
      </form>
    </ContentEditorFrame>
  );
}

function normalizeTarget(v: string): string {
  if (v === "inquiry") return "/contact#inquiry";
  if (v === "URL…") return "/";
  return v;
}
