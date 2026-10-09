"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Field, RichTextField } from "../RichTextField";
import { RowActions } from "../RowActions";
import type { ServiceRow } from "../types";
import { ContentEditorFrame, moveItem, SortableRow } from "./ContentEditorFrame";
import { fromPlainText } from "@/modules/content/render";
import { removeService, reorderServicesList, saveService } from "@/modules/content/admin-mutations";

const ICONS = ["code", "plug", "move", "rocket", "palette", "shield", "chart", "cloud"];

function slugify(v: string): string {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

type Row = ServiceRow & { position?: number };

/** SCR-ADM-24 — sortable services list with the editing sheet (no prices, BR-01) and live preview card. */
export function ServicesEditor({ services: initial }: { services: ServiceRow[] }) {
  const router = useRouter();
  const [services, setServices] = React.useState<Row[]>(initial);
  const [editing, setEditing] = React.useState<Row | "new" | null>(null);
  const [preview, setPreview] = React.useState({ title: "", summary: "" });
  const [icon, setIcon] = React.useState("code");
  const [published, setPublished] = React.useState(false);
  const [delCount, setDelCount] = React.useState(2);
  const [saving, setSaving] = React.useState(false);
  const current = editing && editing !== "new" ? editing : null;
  const formRef = React.useRef<HTMLFormElement>(null);

  function openEdit(s: Row | "new") {
    setEditing(s);
    const row = s === "new" ? null : s;
    setPreview({ title: row?.title ?? "", summary: row?.summary ?? "" });
    setIcon(row?.icon ?? "code");
    setPublished(row?.published ?? false);
    setDelCount(Math.max(row?.deliverables.length ?? 2, 2));
  }

  async function handleSave() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const slug = String(data.get("slug") ?? "").trim() || slugify(title);
    const deliverables = data
      .getAll("deliverable")
      .map(String)
      .map((d) => d.trim())
      .filter(Boolean);

    setSaving(true);
    const result = await saveService({
      id: current?.id,
      slug,
      title,
      summary: String(data.get("summary") ?? "").trim(),
      deliverables,
      bodyJson: fromPlainText(String(data.get("body") ?? "")),
      icon,
      position: current?.position ?? services.length,
      published,
    });
    setSaving(false);

    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Service saved — content revalidated");
    setEditing(null);
    router.refresh();
  }

  async function handleDelete(s: Row) {
    const result = await removeService({ id: s.id });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setServices((l) => l.filter((x) => x.id !== s.id));
    toast.success("Service deleted");
    router.refresh();
  }

  async function persistOrder(list: Row[]) {
    setServices(list);
    const result = await reorderServicesList({ ids: list.map((s) => s.id) });
    if (!result.ok) toast.error(result.error.message);
    else router.refresh();
  }

  return (
    <ContentEditorFrame
      title={`Services · ${services.length}`}
      description="Shown on /services and in the landing “What we build” chapter. Services never carry prices (BR-01)."
      previewHref="/services?preview=draft"
      hideSaveBar
      headerActions={
        <Button size="sm" onClick={() => openEdit("new")}>
          <PlusIcon aria-hidden /> Add service
        </Button>
      }
    >
      {services.length === 0 ? (
        <p className="text-body-sm text-fg-muted">No services yet — add your first one.</p>
      ) : null}
      <ol className="space-y-2" aria-label="Services">
        {services.map((s, i) => (
          <SortableRow
            key={s.id}
            index={i}
            total={services.length}
            label={s.title}
            onMove={(f, t) => persistOrder(moveItem(services, f, t))}
          >
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="grid size-9 place-items-center rounded-sm bg-elevated font-mono text-caption text-fg-muted"
              >
                {s.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-body-sm font-semibold">
                  {s.title}{" "}
                  <span className="font-mono text-caption font-normal text-fg-muted">
                    /{s.slug}
                  </span>
                </p>
                <p className="truncate text-caption text-fg-muted">{s.summary}</p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id={`svc-pub-${s.id}`}
                  size="sm"
                  checked={s.published}
                  onCheckedChange={async (v) => {
                    setServices((l) => l.map((x) => (x.id === s.id ? { ...x, published: v } : x)));
                    const result = await saveService({
                      id: s.id,
                      slug: s.slug,
                      title: s.title,
                      summary: s.summary,
                      deliverables: s.deliverables,
                      bodyJson: fromPlainText(""),
                      icon: s.icon,
                      position: s.position ?? i,
                      published: v,
                    });
                    if (!result.ok) {
                      toast.error(result.error.message);
                      setServices((l) =>
                        l.map((x) => (x.id === s.id ? { ...x, published: !v } : x)),
                      );
                    } else {
                      router.refresh();
                    }
                  }}
                  aria-label={`Published: ${s.title}`}
                />
                <RowActions
                  label={`Actions for ${s.title}`}
                  actions={[
                    { label: "Edit", onSelect: () => openEdit(s) },
                    {
                      label: "Delete",
                      destructive: true,
                      separatorBefore: true,
                      onSelect: () => handleDelete(s),
                    },
                  ]}
                />
              </div>
            </div>
          </SortableRow>
        ))}
      </ol>

      <Sheet open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="overflow-y-auto lg:w-[640px] tv:w-[760px]">
          <SheetHeader>
            <SheetTitle>{current ? `Edit ${current.title}` : "New service"}</SheetTitle>
            <SheetDescription>
              Slug is generated from the title if left blank; conflicts are checked on save.
            </SheetDescription>
          </SheetHeader>
          <form
            ref={formRef}
            className="space-y-4 px-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >
            <Field id="sv-title" label="Title" required>
              <Input
                id="sv-title"
                name="title"
                defaultValue={current?.title}
                onChange={(e) => setPreview((p) => ({ ...p, title: e.target.value }))}
                required
                aria-required
              />
            </Field>
            <Field id="sv-slug" label="Slug" hint="Leave blank to generate from the title.">
              <Input id="sv-slug" name="slug" defaultValue={current?.slug} className="font-mono" />
            </Field>
            <Field id="sv-icon" label="Icon">
              <Select value={icon} onValueChange={setIcon}>
                <SelectTrigger id="sv-icon">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ICONS.map((i) => (
                    <SelectItem key={i} value={i}>
                      {i}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              id="sv-summary"
              label="Summary"
              required
              hint="No pricing — services are inquiry-only (BR-01). 300 chars."
            >
              <Textarea
                id="sv-summary"
                name="summary"
                rows={2}
                maxLength={300}
                defaultValue={current?.summary}
                onChange={(e) => setPreview((p) => ({ ...p, summary: e.target.value }))}
              />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-body-sm font-semibold">
                Deliverables <span className="font-normal text-fg-muted">(up to 20)</span>
              </legend>
              {Array.from({ length: delCount }).map((_, i) => (
                <div key={i}>
                  <Label htmlFor={`sv-del-${i}`} className="sr-only">
                    Deliverable {i + 1}
                  </Label>
                  <Input
                    id={`sv-del-${i}`}
                    name="deliverable"
                    defaultValue={current?.deliverables[i]}
                    className="h-8"
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDelCount((n) => Math.min(n + 1, 20))}
              >
                Add line
              </Button>
            </fieldset>
            <RichTextField id="sv-body" name="body" label="Body" rows={4} />
            <div className="flex items-center gap-2">
              <Switch id="sv-pub" checked={published} onCheckedChange={setPublished} />
              <Label htmlFor="sv-pub">Published</Label>
            </div>
            <section aria-label="Preview" className="rounded-lg border border-border bg-canvas p-4">
              <p className="mb-1 text-overline tracking-wider text-fg-muted uppercase">Preview</p>
              <p className="text-h4">{preview.title || "Service title"}</p>
              <p className="text-body-sm text-fg-muted">
                {preview.summary || "Summary appears here."}
              </p>
              <Badge tone="ghost" size="sm" className="mt-2">
                Inquiry only
              </Badge>
            </section>
          </form>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ContentEditorFrame>
  );
}
