"use client";

import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Banner } from "../Banner";
import { formatDate } from "../format";
import { Field, RichTextField } from "../RichTextField";
import type { LegalPage } from "../types";
import { ContentEditorFrame } from "./ContentEditorFrame";

/** SCR-ADM-28 — four versioned legal pages: rail, full Tiptap editor, clause checklist and version history (Super Admin only). */
export function LegalEditor({
  pages,
  isSuperAdmin,
}: {
  pages: LegalPage[];
  isSuperAdmin: boolean;
}) {
  const [active, setActive] = React.useState<LegalPage["key"]>("privacy");
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [summary, setSummary] = React.useState("");
  const page = pages.find((p) => p.key === active) ?? pages[0];
  if (!page) return null;
  const rail = pages.map((p) => ({
    key: p.key,
    label: p.title,
    meta: `v${p.version} · published ${formatDate(p.publishedAt)}`,
    badge: p.hasDraft ? (
      <Badge tone="warning" size="sm">
        draft
      </Badge>
    ) : undefined,
  }));

  return (
    <ContentEditorFrame
      title="Legal pages"
      description="Publishing creates a new version with a public effective date; previous versions remain viewable."
      rail={rail}
      railLabel="Legal pages"
      active={active}
      onSelect={(k) => setActive(k as LegalPage["key"])}
      previewHref={`/legal/${page.key}?preview=draft`}
      saveLabel="Save draft"
      headerActions={
        <Button size="sm" onClick={() => setPublishOpen(true)} disabled={!isSuperAdmin}>
          Publish new version
        </Button>
      }
      panel={
        <>
          <section
            aria-label="Clause checklist"
            className="rounded-lg border border-border bg-surface p-4"
          >
            <h2 className="mb-2 text-h4">Checklist</h2>
            <ul className="space-y-2">
              {page.checklist.map((c, i) => (
                <li key={c.label} className="flex items-start gap-2">
                  <Checkbox id={`cl-${page.key}-${i}`} defaultChecked={c.done} />
                  <Label htmlFor={`cl-${page.key}-${i}`} className="leading-snug font-normal">
                    {c.label}
                  </Label>
                </li>
              ))}
            </ul>
          </section>
          <section
            aria-label="Version history"
            className="rounded-lg border border-border bg-surface"
          >
            <h2 className="border-b border-border px-4 py-3 text-h4">Version history</h2>
            <Table>
              <TableCaption className="sr-only">Versions</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>v</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.history.map((h) => (
                  <TableRow key={h.version}>
                    <TableCell className="font-mono">v{h.version}</TableCell>
                    <TableCell className="text-fg-muted">
                      {formatDate(h.publishedAt)}
                      <span className="block text-caption">{h.by}</span>
                    </TableCell>
                    <TableCell className="whitespace-normal text-fg-muted">{h.summary}</TableCell>
                    <TableCell>
                      <span className="flex flex-col">
                        <Button variant="link" size="sm">
                          View
                        </Button>
                        <Button variant="link" size="sm" onClick={() => toast("Loaded into draft")}>
                          Restore as draft
                        </Button>
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </>
      }
    >
      {!isSuperAdmin ? (
        <Banner tone="danger" className="mb-4">
          Legal pages are Super Admin only (403 for Admin-role).
        </Banner>
      ) : null}
      <Banner tone="neutral" className="mb-4">
        No public contact details on the site; the privacy page may reference the inquiry form and
        dashboard queries only (D-808). Invoice contact numbers are separate (D-406).
      </Banner>
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()} key={page.key}>
        <div className="flex items-center gap-2">
          <h2 className="text-h3">{page.title}</h2>
          <Badge tone="success" size="sm">
            v{page.version}
          </Badge>
          {page.hasDraft ? (
            <Badge tone="warning" size="sm">
              draft in progress
            </Badge>
          ) : null}
        </div>
        <Field id="lg-title" label="Title" required>
          <Input id="lg-title" defaultValue={page.title} />
        </Field>
        <RichTextField id="lg-body" label="Body" required defaultValue={page.body} rows={14} full />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="lg-effective" label="Effective date">
            <Input id="lg-effective" type="date" defaultValue={page.effectiveDate} />
          </Field>
          <Field
            id="lg-summary"
            label="Change summary (internal)"
            required
            hint="200 chars · required to publish"
          >
            <Input
              id="lg-summary"
              maxLength={200}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
            />
          </Field>
        </div>
      </form>
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Publish {page.title} v{page.version + 1}?
            </DialogTitle>
            <DialogDescription>
              Customers see the new effective date; checkout consent references the current version.
            </DialogDescription>
          </DialogHeader>
          {summary.trim() === "" ? (
            <Banner tone="danger" role="alert">
              Publish is blocked until the change summary is filled.
            </Banner>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              disabled={summary.trim() === ""}
              onClick={() => {
                toast.success(`${page.title} v${page.version + 1} published`);
                setPublishOpen(false);
              }}
            >
              Publish v{page.version + 1}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentEditorFrame>
  );
}
