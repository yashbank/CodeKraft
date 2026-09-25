"use client";

import * as React from "react";
import { PlusIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

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

/** SCR-ADM-25 — case studies list and the tabbed editor (Story / Media / SEO). */
export function CaseStudiesEditor({ caseStudies }: { caseStudies: CaseStudyRow[] }) {
  const [status, setStatus] = React.useState<"draft" | "published" | null>(null);
  const [editing, setEditing] = React.useState<CaseStudyRow | null>(caseStudies[0] ?? null);
  const rows = caseStudies.filter((c) => (status ? c.status === status : true));

  return (
    <ContentEditorFrame
      title="Case studies"
      description="Project stories rendered at /projects/[slug] and in the Proof chapter. Company-brand only — no partner or team names (D-103)."
      previewHref={editing ? `/projects/${editing.slug}?preview=draft` : undefined}
      headerActions={
        <>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              toast.success(
                editing?.status === "published"
                  ? "Unpublished"
                  : `Published — live at /projects/${editing?.slug ?? ""}`,
              )
            }
            disabled={!editing}
          >
            {editing?.status === "published" ? "Unpublish" : "Publish"}
          </Button>
          <Button size="sm" onClick={() => setEditing(null)}>
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
            {rows.map((c) => (
              <TableRow key={c.id} data-state={editing?.id === c.id ? "selected" : undefined}>
                <TableCell>
                  <span aria-hidden className="block h-9 w-12 rounded-sm bg-elevated" />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => setEditing(c)}
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
                      { label: "Edit", onSelect: () => setEditing(c) },
                      { label: "Preview" },
                      { label: c.status === "published" ? "Unpublish" : "Publish" },
                      { label: "Duplicate" },
                      { label: "Delete", destructive: true, separatorBefore: true },
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
          Publish requires a cover image and all three story sections. Changing a published slug
          writes a 301 redirect.
        </Banner>
        <Tabs defaultValue="story" key={editing?.id ?? "new"}>
          <TabsList>
            <TabsTrigger value="story">Story</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="seo">SEO</TabsTrigger>
          </TabsList>
          <TabsContent value="story" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="cs-title" label="Title" required>
                <Input id="cs-title" defaultValue={editing?.title} />
              </Field>
              <Field id="cs-slug" label="Slug" required>
                <Input id="cs-slug" defaultValue={editing?.slug} className="font-mono" />
              </Field>
              <Field id="cs-client" label="Client name" hint="Blank → “Confidential client”.">
                <Input
                  id="cs-client"
                  defaultValue={editing?.client === "Confidential client" ? "" : editing?.client}
                />
              </Field>
              <Field id="cs-industry" label="Industry">
                <Input id="cs-industry" defaultValue={editing?.industry} />
              </Field>
              <Field id="cs-tech" label="Tech stack" className="sm:col-span-2">
                <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2 py-1">
                  {(editing?.tech ?? []).map((t) => (
                    <Badge key={t} tone="accent">
                      {t}
                    </Badge>
                  ))}
                  <Input id="cs-tech" placeholder="Add" className="h-7 w-24 border-0 px-1" />
                </div>
              </Field>
            </div>
            <RichTextField id="cs-problem" label="Problem" required rows={3} />
            <RichTextField id="cs-solution" label="Solution" required rows={3} />
            <RichTextField id="cs-results" label="Results" required rows={3} />
            <fieldset className="space-y-2">
              <legend className="text-body-sm font-semibold">
                Metrics <span className="font-normal text-fg-muted">(up to 4)</span>
              </legend>
              {[
                ["Load time", "−60%"],
                ["Checkout drop-off", "−38%"],
              ].map(([l, v], i) => (
                <div key={l} className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor={`cs-m-l-${i}`} className="sr-only">
                      Metric {i + 1} label
                    </label>
                    <Input id={`cs-m-l-${i}`} defaultValue={l} className="h-8" />
                  </div>
                  <div>
                    <label htmlFor={`cs-m-v-${i}`} className="sr-only">
                      Metric {i + 1} value
                    </label>
                    <Input id={`cs-m-v-${i}`} defaultValue={v} className="h-8 font-mono" />
                  </div>
                </div>
              ))}
            </fieldset>
          </TabsContent>
          <TabsContent value="media" className="space-y-4">
            <div className="rounded-lg border-2 border-dashed border-border-strong p-6 text-center">
              <UploadIcon aria-hidden className="mx-auto size-6 text-fg-subtle" />
              <p className="mt-1 text-body-sm">Cover image (4:3) and gallery · alt text required</p>
            </div>
            <Field id="cs-cover-alt" label="Cover alt text" required>
              <Input
                id="cs-cover-alt"
                defaultValue="Textile exporter's client portal on a laptop"
              />
            </Field>
            <ul className="space-y-2">
              {["portal-home.png", "order-tracking.png"].map((f, i) => (
                <li
                  key={f}
                  className="flex items-center gap-3 rounded-md border border-border p-2 text-body-sm"
                >
                  <span aria-hidden className="h-10 w-14 rounded-sm bg-elevated" />
                  <span className="flex-1 font-mono">{f}</span>
                  <Input
                    aria-label={`Caption for ${f}`}
                    placeholder="Caption"
                    className="h-8 w-48"
                  />
                  <Input
                    aria-label={`Alt text for ${f}`}
                    placeholder="Alt text *"
                    className="h-8 w-48"
                    required
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${f} up`}
                    disabled={i === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${f} down`}
                    disabled={i === 1}
                  >
                    ↓
                  </Button>
                </li>
              ))}
            </ul>
          </TabsContent>
          <TabsContent value="seo" className="space-y-4">
            <Field id="cs-seo-title" label="SEO title" hint="≤ 60 chars">
              <Input id="cs-seo-title" maxLength={60} defaultValue={editing?.title} />
            </Field>
            <Field id="cs-seo-desc" label="Meta description" hint="≤ 160 chars">
              <Textarea id="cs-seo-desc" maxLength={160} rows={2} />
            </Field>
            <div className="rounded-md border border-border bg-canvas p-3">
              <p className="text-caption text-fg-muted">OG preview</p>
              <p className="text-body font-semibold">{editing?.title ?? "Title"}</p>
              <p className="text-caption text-fg-muted">
                codekraft.example/projects/{editing?.slug ?? "slug"}
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </section>
    </ContentEditorFrame>
  );
}
