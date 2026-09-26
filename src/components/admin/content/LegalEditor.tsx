"use client";

import * as React from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
import { fromPlainText } from "@/modules/content/render";
import { publishLegalPageByKey, saveLegalPage } from "@/modules/content/admin-mutations";

/** SCR-ADM-28 — four versioned legal pages: rail, plain-text editor, clause checklist and version history (Super Admin only). */
export function LegalEditor({
  pages,
  isSuperAdmin,
}: {
  pages: LegalPage[];
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [active, setActive] = React.useState<LegalPage["key"]>(pages[0]?.key ?? "privacy");
  const [publishOpen, setPublishOpen] = React.useState(false);
  const [summary, setSummary] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
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

  async function handleSave() {
    const form = formRef.current;
    if (!form || !isSuperAdmin || !page) return;
    const data = new FormData(form);
    setSaving(true);
    const result = await saveLegalPage({
      key: page.key,
      title: String(data.get("title") ?? "").trim(),
      bodyJson: fromPlainText(String(data.get("body") ?? "")),
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Draft saved");
    router.refresh();
  }

  async function handlePublish() {
    if (!page) return;
    const result = await publishLegalPageByKey({ key: page.key });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`${page.title} v${page.version + 1} published`);
    setPublishOpen(false);
    setSummary("");
    router.refresh();
  }

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
      onSave={handleSave}
      headerActions={
        <Button size="sm" onClick={() => setPublishOpen(true)} disabled={!isSuperAdmin}>
          Publish new version
        </Button>
      }
      panel={
        <>
          <section aria-label="Version history" className="rounded-lg border border-border bg-surface">
            <h2 className="border-b border-border px-4 py-3 text-h4">Version history</h2>
            <Table>
              <TableCaption className="sr-only">Versions</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>v</TableHead>
                  <TableHead>Published</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {page.history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-body-sm text-fg-muted">
                      Not published yet
                    </TableCell>
                  </TableRow>
                ) : null}
                {page.history.map((h) => (
                  <TableRow key={h.version}>
                    <TableCell className="font-mono">v{h.version}</TableCell>
                    <TableCell className="text-fg-muted">{formatDate(h.publishedAt)}</TableCell>
                    <TableCell className="text-fg-muted">{h.by}</TableCell>
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
        dashboard queries only (D-808).
      </Banner>
      <form ref={formRef} className="space-y-4" onSubmit={(e) => e.preventDefault()} key={page.key}>
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
          <Input id="lg-title" name="title" defaultValue={page.title} disabled={!isSuperAdmin} />
        </Field>
        <RichTextField
          id="lg-body"
          name="body"
          label="Body"
          required
          defaultValue={page.body}
          rows={14}
          full
        />
      </form>
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Publish {page.title} v{page.version + 1}?
            </DialogTitle>
            <DialogDescription>
              Customers see the new effective date; checkout consent references the current
              version. Save your draft first — publishing snapshots the currently saved text.
            </DialogDescription>
          </DialogHeader>
          <Field id="lg-summary" label="Change summary (internal note)" hint="Not stored yet — for your own reference while reviewing.">
            <Input id="lg-summary" maxLength={200} value={summary} onChange={(e) => setSummary(e.target.value)} />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={handlePublish}>Publish v{page.version + 1}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ContentEditorFrame>
  );
}
