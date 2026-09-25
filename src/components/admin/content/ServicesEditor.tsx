"use client";

import * as React from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

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

const ICONS = ["code", "plug", "move", "rocket", "palette", "shield", "chart", "cloud"];

/** SCR-ADM-24 — sortable services list with the editing sheet (no prices, BR-01) and live preview card. */
export function ServicesEditor({ services: initial }: { services: ServiceRow[] }) {
  const [services, setServices] = React.useState(initial);
  const [editing, setEditing] = React.useState<ServiceRow | "new" | null>(null);
  const [preview, setPreview] = React.useState({ title: "", summary: "" });
  const current = editing && editing !== "new" ? editing : null;

  return (
    <ContentEditorFrame
      title={`Services · ${services.length}`}
      description="Shown on /services and in the landing “What we build” chapter. Services never carry prices (BR-01)."
      previewHref="/services?preview=draft"
      headerActions={
        <Button
          size="sm"
          onClick={() => {
            setEditing("new");
            setPreview({ title: "", summary: "" });
          }}
        >
          <PlusIcon aria-hidden /> Add service
        </Button>
      }
    >
      <ol className="space-y-2" aria-label="Services">
        {services.map((s, i) => (
          <SortableRow
            key={s.id}
            index={i}
            total={services.length}
            label={s.title}
            onMove={(f, t) => setServices((l) => moveItem(l, f, t))}
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
                  onCheckedChange={(v) =>
                    setServices((l) => l.map((x) => (x.id === s.id ? { ...x, published: v } : x)))
                  }
                  aria-label={`Published: ${s.title}`}
                />
                <RowActions
                  label={`Actions for ${s.title}`}
                  actions={[
                    {
                      label: "Edit",
                      onSelect: () => {
                        setEditing(s);
                        setPreview({ title: s.title, summary: s.summary });
                      },
                    },
                    { label: "Duplicate" },
                    {
                      label: "Delete",
                      destructive: true,
                      separatorBefore: true,
                      onSelect: () =>
                        toast("Leads referencing this service keep their service_interest text"),
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
              Slug is generated from the title; conflicts are checked on save.
            </SheetDescription>
          </SheetHeader>
          <form className="space-y-4 px-4" onSubmit={(e) => e.preventDefault()}>
            <Field id="sv-title" label="Title" required>
              <Input
                id="sv-title"
                defaultValue={current?.title}
                onChange={(e) => setPreview((p) => ({ ...p, title: e.target.value }))}
                required
                aria-required
              />
            </Field>
            <Field id="sv-slug" label="Slug" required>
              <Input id="sv-slug" defaultValue={current?.slug} className="font-mono" />
            </Field>
            <Field id="sv-icon" label="Icon">
              <Select defaultValue={current?.icon ?? "code"}>
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
              hint="No pricing — services are inquiry-only (BR-01). 200 chars."
            >
              <Textarea
                id="sv-summary"
                rows={2}
                maxLength={200}
                defaultValue={current?.summary}
                onChange={(e) => setPreview((p) => ({ ...p, summary: e.target.value }))}
              />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-body-sm font-semibold">
                Deliverables <span className="font-normal text-fg-muted">(up to 10)</span>
              </legend>
              {(current?.deliverables ?? ["", ""]).map((d, i) => (
                <div key={i}>
                  <Label htmlFor={`sv-del-${i}`} className="sr-only">
                    Deliverable {i + 1}
                  </Label>
                  <Input id={`sv-del-${i}`} defaultValue={d} className="h-8" />
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm">
                Add line
              </Button>
            </fieldset>
            <RichTextField id="sv-body" label="Body" rows={4} />
            <div className="flex items-center gap-2">
              <Switch id="sv-pub" defaultChecked={current?.published ?? false} />
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
            <Button
              onClick={() => {
                toast.success("Service saved — content revalidated, assistant index updating");
                setEditing(null);
              }}
            >
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ContentEditorFrame>
  );
}
