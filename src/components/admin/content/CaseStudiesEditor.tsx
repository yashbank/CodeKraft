"use client";

import * as React from "react";
import { PlusIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Banner } from "../Banner";
import { DataToolbar } from "../DataToolbar";
import { FilterChips } from "../FilterChips";
import { formatDate, formatDateTime } from "../format";
import { Field, RichTextField } from "../RichTextField";
import { RowActions } from "../RowActions";
import type { CaseStudyRow } from "../types";
import { ContentEditorFrame } from "./ContentEditorFrame";
import { fromPlainText } from "@/modules/content/render";
import {
  publishCaseStudyById,
  removeCaseStudy,
  saveCaseStudy,
  unpublishCaseStudyById,
} from "@/modules/content/admin-mutations";

function slugify(v: string): string {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** SCR-ADM-25 — case studies list and the tabbed editor (Story / Media / SEO). */
export function CaseStudiesEditor({ caseStudies: initial }: { caseStudies: CaseStudyRow[] }) {
  const router = useRouter();
  const [caseStudies, setCaseStudies] = React.useState(initial);
  const [status, setStatus] = React.useState<"draft" | "published" | null>(null);
  const [editing, setEditing] = React.useState<CaseStudyRow | null>(caseStudies[0] ?? null);
  const [tech, setTech] = React.useState<string[]>(editing?.tech ?? []);
  const [techDraft, setTechDraft] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [cover, setCover] = React.useState<{ mediaId?: string; url?: string }>({
    mediaId: editing?.coverMediaId,
    url: editing?.coverUrl,
  });
  const [uploading, setUploading] = React.useState(false);
  const [gallery, setGallery] = React.useState<NonNullable<CaseStudyRow["gallery"]>>(
    editing?.gallery ?? [],
  );
  const [galleryUploading, setGalleryUploading] = React.useState(false);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const coverInputRef = React.useRef<HTMLInputElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);
  const rows = caseStudies.filter((c) => (status ? c.status === status : true));

  function openEdit(c: CaseStudyRow | null) {
    setEditing(c);
    setTech(c?.tech ?? []);
    setTechDraft("");
    setCover({ mediaId: c?.coverMediaId, url: c?.coverUrl });
    setGallery(c?.gallery ?? []);
  }

  async function handleGalleryChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    if (gallery.length + files.length > 24) {
      toast.error("A gallery holds at most 24 images");
      return;
    }
    setGalleryUploading(true);
    try {
      const { uploadMediaFile } = await import("@/lib/admin/media-upload");
      for (const f of files) {
        const up = await uploadMediaFile(f, "content_media");
        const item = {
          mediaId: up.mediaId,
          url: up.url ?? URL.createObjectURL(f),
          alt: f.name.replace(/\.[^.]+$/, "").slice(0, 125),
        };
        setGallery((l) => [...l, item]);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setGalleryUploading(false);
    }
  }

  function moveGallery(index: number, dir: -1 | 1) {
    setGallery((l) => {
      const t = index + dir;
      const a = l[index];
      const b = l[t];
      if (!a || !b) return l;
      const next = [...l];
      next[index] = b;
      next[t] = a;
      return next;
    });
  }

  async function handleCoverChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { uploadMediaFile } = await import("@/lib/admin/media-upload");
      const up = await uploadMediaFile(file, "content_media");
      setCover({ mediaId: up.mediaId, url: up.url ?? URL.createObjectURL(file) });
      toast.success("Cover uploaded — save the case study to apply it");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const slug = String(data.get("slug") ?? "").trim() || slugify(title);
    const resultHighlight = String(data.get("resultHighlight") ?? "").trim();
    if (gallery.some((g) => !g.alt.trim())) {
      toast.error("Every gallery image needs alt text");
      return;
    }

    setSaving(true);
    const result = await saveCaseStudy({
      id: editing?.id,
      slug,
      title,
      clientName: String(data.get("client") ?? "").trim() || "Confidential client",
      industry: String(data.get("industry") ?? "").trim(),
      problemJson: fromPlainText(String(data.get("problem") ?? "")),
      solutionJson: fromPlainText(String(data.get("solution") ?? "")),
      resultsJson: fromPlainText(String(data.get("results") ?? "")),
      resultHighlight: resultHighlight || undefined,
      techStack: tech,
      coverMediaId: cover.mediaId,
      gallery: gallery.map(({ mediaId, alt }) => ({ mediaId, alt })),
      seoTitle: String(data.get("seoTitle") ?? "").trim() || undefined,
      seoDescription: String(data.get("seoDescription") ?? "").trim() || undefined,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Case study saved");
    router.refresh();
  }

  async function handlePublishToggle() {
    if (!editing) return;
    const result =
      editing.status === "published"
        ? await unpublishCaseStudyById({ id: editing.id })
        : await publishCaseStudyById({ id: editing.id });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(
      editing.status === "published"
        ? "Unpublished"
        : `Published — live at /projects/${editing.slug}`,
    );
    router.refresh();
  }

  async function handleDelete(c: CaseStudyRow) {
    const result = await removeCaseStudy({ id: c.id });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setCaseStudies((l) => l.filter((x) => x.id !== c.id));
    if (editing?.id === c.id) openEdit(null);
    toast.success("Case study deleted");
    router.refresh();
  }

  return (
    <ContentEditorFrame
      title="Case studies"
      description="Project stories rendered at /projects/[slug] and in the Proof chapter. Company-brand only — no partner or team names (D-103)."
      previewHref={editing ? `/projects/${editing.slug}?preview=draft` : undefined}
      hideSaveBar
      headerActions={
        <>
          <Button size="sm" variant="secondary" onClick={handlePublishToggle} disabled={!editing}>
            {editing?.status === "published" ? "Unpublish" : "Publish"}
          </Button>
          <Button size="sm" onClick={() => openEdit(null)}>
            <PlusIcon aria-hidden /> New case study
          </Button>
        </>
      }
      wide
    >
      <FilterChips
        label="Status"
        chips={[
          {
            value: "draft",
            label: "Draft",
            count: caseStudies.filter((c) => c.status === "draft").length,
          },
          {
            value: "published",
            label: "Published",
            count: caseStudies.filter((c) => c.status === "published").length,
          },
        ]}
        value={status}
        onChange={setStatus}
      />
      <div className="mt-3">
        <DataToolbar searchId="cs-search" searchPlaceholder="Title, client…" />
      </div>
      <div className="rounded-lg border border-border bg-surface">
        <Table>
          <TableCaption className="sr-only">Case studies</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Cover</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Tech</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Published</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-body-sm text-fg-muted">
                  No case studies yet.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((c) => (
              <TableRow key={c.id} data-state={editing?.id === c.id ? "selected" : undefined}>
                <TableCell>
                  <span aria-hidden className="block h-9 w-12 rounded-sm bg-elevated" />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => openEdit(c)}
                    className="text-left font-medium hover:text-accent-text"
                  >
                    {c.title}
                  </button>
                </TableCell>
                <TableCell className="text-fg-muted">{c.client}</TableCell>
                <TableCell className="text-fg-muted">{c.industry}</TableCell>
                <TableCell>
                  <span className="flex flex-wrap gap-1">
                    {c.tech.map((t) => (
                      <Badge key={t} tone="neutral" size="sm">
                        {t}
                      </Badge>
                    ))}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge kind="product_blogs.status" value={c.status} size="sm" />
                </TableCell>
                <TableCell className="text-fg-muted">
                  {c.publishedAt ? formatDate(c.publishedAt) : "—"}
                </TableCell>
                <TableCell className="text-fg-muted">{formatDateTime(c.updatedAt)}</TableCell>
                <TableCell>
                  <RowActions
                    label={`Actions for ${c.title}`}
                    actions={[
                      { label: "Edit", onSelect: () => openEdit(c) },
                      {
                        label: "Delete",
                        destructive: true,
                        separatorBefore: true,
                        onSelect: () => handleDelete(c),
                      },
                    ]}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <section
        aria-label={editing ? `Editor · ${editing.title}` : "New case study"}
        className="mt-6 space-y-4 rounded-lg border border-border bg-surface p-5"
      >
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-h3">{editing?.title ?? "New case study"}</h2>
          {editing ? (
            <StatusBadge kind="product_blogs.status" value={editing.status} size="sm" />
          ) : null}
        </div>
        <Banner tone="neutral">
          Publish requires all three story sections. Cover image upload is coming in a follow-up
          update — case studies publish fine without one for now.
        </Banner>
        <form
          ref={formRef}
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <Tabs defaultValue="story" key={editing?.id ?? "new"}>
            <TabsList>
              <TabsTrigger value="story">Story</TabsTrigger>
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
            </TabsList>
            <TabsContent
              value="story"
              forceMount
              className="space-y-4 data-[state=inactive]:hidden"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="cs-title" label="Title" required>
                  <Input
                    id="cs-title"
                    name="title"
                    defaultValue={editing?.title}
                    required
                    aria-required
                  />
                </Field>
                <Field id="cs-slug" label="Slug" hint="Leave blank to generate from the title.">
                  <Input
                    id="cs-slug"
                    name="slug"
                    defaultValue={editing?.slug}
                    className="font-mono"
                  />
                </Field>
                <Field id="cs-client" label="Client name" hint='Blank → "Confidential client".'>
                  <Input
                    id="cs-client"
                    name="client"
                    defaultValue={editing?.client === "Confidential client" ? "" : editing?.client}
                  />
                </Field>
                <Field id="cs-industry" label="Industry" required>
                  <Input
                    id="cs-industry"
                    name="industry"
                    defaultValue={editing?.industry}
                    required
                    aria-required
                  />
                </Field>
                <Field
                  id="cs-highlight"
                  label="Result highlight"
                  hint="Short headline stat, e.g. +40% conversion. 60 chars."
                >
                  <Input
                    id="cs-highlight"
                    name="resultHighlight"
                    maxLength={60}
                    defaultValue={editing?.resultHighlight}
                  />
                </Field>
                <Field id="cs-tech" label="Tech stack" className="sm:col-span-2">
                  <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2 py-1">
                    {tech.map((t) => (
                      <Badge
                        key={t}
                        tone="accent"
                        className="cursor-pointer"
                        onClick={() => setTech((l) => l.filter((x) => x !== t))}
                      >
                        {t} ×
                      </Badge>
                    ))}
                    <Input
                      id="cs-tech"
                      placeholder="Add, press Enter"
                      className="h-7 w-32 border-0 px-1"
                      value={techDraft}
                      onChange={(e) => setTechDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && techDraft.trim()) {
                          e.preventDefault();
                          setTech((l) => Array.from(new Set([...l, techDraft.trim()])));
                          setTechDraft("");
                        }
                      }}
                    />
                  </div>
                </Field>
              </div>
              <RichTextField
                id="cs-problem"
                name="problem"
                defaultValue={editing?.problem}
                label="Problem"
                required
                rows={3}
              />
              <RichTextField
                id="cs-solution"
                name="solution"
                defaultValue={editing?.solution}
                label="Solution"
                required
                rows={3}
              />
              <RichTextField
                id="cs-results"
                name="results"
                defaultValue={editing?.results}
                label="Results"
                required
                rows={3}
              />
            </TabsContent>
            <TabsContent
              value="media"
              forceMount
              className="space-y-4 data-[state=inactive]:hidden"
            >
              <input
                ref={coverInputRef}
                type="file"
                className="sr-only"
                accept="image/*"
                aria-label="Cover image file"
                onChange={handleCoverChosen}
              />
              <div className="flex items-center gap-3">
                {cover.url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- admin preview of a user-uploaded R2 URL
                  <img
                    src={cover.url}
                    alt=""
                    className="h-20 w-32 rounded-md border border-border object-cover"
                  />
                ) : (
                  <div className="grid h-20 w-32 place-items-center rounded-md border border-dashed border-border-strong text-caption text-fg-subtle">
                    No cover
                  </div>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  loading={uploading}
                  onClick={() => coverInputRef.current?.click()}
                >
                  <UploadIcon aria-hidden /> {cover.url ? "Replace cover" : "Upload cover"}
                </Button>
              </div>
              <input
                ref={galleryInputRef}
                type="file"
                multiple
                className="sr-only"
                accept="image/*"
                aria-label="Gallery image files"
                onChange={handleGalleryChosen}
              />
              <ul className="space-y-2">
                {gallery.map((g, i) => (
                  <li key={g.mediaId} className="flex items-center gap-2">
                    {g.url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- admin preview of a user-uploaded R2 URL
                      <img
                        src={g.url}
                        alt=""
                        className="h-12 w-16 rounded-sm border border-border object-cover"
                      />
                    ) : null}
                    <Input
                      aria-label={`Alt text for image ${i + 1}`}
                      value={g.alt}
                      maxLength={125}
                      required
                      onChange={(e) =>
                        setGallery((l) =>
                          l.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)),
                        )
                      }
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Move image ${i + 1} up`}
                      disabled={i === 0}
                      onClick={() => moveGallery(i, -1)}
                    >
                      ▲
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      aria-label={`Move image ${i + 1} down`}
                      disabled={i === gallery.length - 1}
                      onClick={() => moveGallery(i, 1)}
                    >
                      ▼
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setGallery((l) => l.filter((_, j) => j !== i))}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={galleryUploading}
                disabled={gallery.length >= 24}
                onClick={() => galleryInputRef.current?.click()}
              >
                <UploadIcon aria-hidden /> Add gallery images
              </Button>
            </TabsContent>
            <TabsContent value="seo" forceMount className="space-y-4 data-[state=inactive]:hidden">
              <Field id="cs-seo-title" label="SEO title" hint="≤ 70 chars">
                <Input
                  id="cs-seo-title"
                  name="seoTitle"
                  maxLength={70}
                  defaultValue={editing?.seoTitle || editing?.title}
                />
              </Field>
              <Field id="cs-seo-desc" label="Meta description" hint="≤ 160 chars">
                <Textarea
                  id="cs-seo-desc"
                  name="seoDescription"
                  maxLength={160}
                  rows={2}
                  defaultValue={editing?.seoDescription}
                />
              </Field>
              <div className="rounded-md border border-border bg-canvas p-3">
                <p className="text-caption text-fg-muted">OG preview</p>
                <p className="text-body font-semibold">{editing?.title ?? "Title"}</p>
                <p className="text-caption text-fg-muted">
                  codekraft.dev/projects/{editing?.slug ?? "slug"}
                </p>
              </div>
            </TabsContent>
          </Tabs>
          <div className="mt-4 flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </section>
    </ContentEditorFrame>
  );
}
