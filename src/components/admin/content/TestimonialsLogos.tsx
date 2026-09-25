"use client";

import * as React from "react";
import { PlusIcon, TriangleAlertIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/_utils";
import { Banner } from "../Banner";
import { initials } from "../format";
import { Field } from "../RichTextField";
import { RowActions } from "../RowActions";
import type { ClientLogo, TestimonialItem } from "../types";
import { ContentEditorFrame } from "./ContentEditorFrame";

/** SCR-ADM-26 — site/product testimonials grid and the client-logo grid, each with an editor sheet. */
export function TestimonialsLogos({
  testimonials,
  logos: initialLogos,
  products,
  initialTab = "testimonials",
}: {
  testimonials: TestimonialItem[];
  logos: ClientLogo[];
  products: string[];
  initialTab?: "testimonials" | "logos";
}) {
  const [context, setContext] = React.useState<"site" | "product">("site");
  const [logos, setLogos] = React.useState(initialLogos);
  const [tEdit, setTEdit] = React.useState<TestimonialItem | "new" | null>(null);
  const [lEdit, setLEdit] = React.useState<ClientLogo | "new" | null>(null);
  const items = testimonials.filter((t) => t.context === context);
  const t = tEdit && tEdit !== "new" ? tEdit : null;
  const l = lEdit && lEdit !== "new" ? lEdit : null;

  return (
    <ContentEditorFrame
      title="Testimonials & logos"
      description="Curated by admins; there are no public reviews or ratings (X-007). Only publish quotes you have permission to use."
      wide
    >
      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="testimonials">Testimonials</TabsTrigger>
          <TabsTrigger value="logos">Client logos</TabsTrigger>
        </TabsList>
        <TabsContent value="testimonials" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={context} onValueChange={(v) => setContext(v as typeof context)}>
              <TabsList variant="line">
                <TabsTrigger value="site">Site</TabsTrigger>
                <TabsTrigger value="product">Product</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" onClick={() => setTEdit("new")}>
              <PlusIcon aria-hidden /> Add testimonial
            </Button>
          </div>
          {context === "product" ? (
            <Banner tone="neutral">
              Product testimonials are edited in the product editor; listed here for overview.
            </Banner>
          ) : null}
          <ul
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 tv:grid-cols-4"
            aria-label="Testimonials"
          >
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
              >
                <p className="line-clamp-3 text-body">“{item.quote}”</p>
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback>{initials(item.author)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 text-caption">
                    <p className="truncate font-medium text-fg">{item.author}</p>
                    <p className="truncate text-fg-muted">
                      {[item.title, item.company].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2">
                  {item.product ? (
                    <Badge tone="accent" size="sm">
                      {item.product}
                    </Badge>
                  ) : (
                    <span />
                  )}
                  <span className="flex items-center gap-2">
                    <Switch
                      id={`tm-${item.id}`}
                      size="sm"
                      defaultChecked={item.published}
                      aria-label={`Published: ${item.author}`}
                    />
                    <RowActions
                      label={`Actions for testimonial by ${item.author}`}
                      actions={[
                        { label: "Edit", onSelect: () => setTEdit(item) },
                        { label: "Delete", destructive: true },
                      ]}
                    />
                  </span>
                </div>
              </li>
            ))}
            {items.length === 0 ? (
              <li className="text-body-sm text-fg-muted">No testimonials yet</li>
            ) : null}
          </ul>
        </TabsContent>
        <TabsContent value="logos" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setLEdit("new")}>
              <PlusIcon aria-hidden /> Add logo
            </Button>
          </div>
          <ul
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 tv:grid-cols-4"
            aria-label="Client logos"
          >
            {logos.map((logo, i) => (
              <li
                key={logo.id}
                className="space-y-2 rounded-lg border border-border bg-surface p-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className="grid h-16 place-items-center rounded-sm bg-inverse text-inverse-fg text-caption"
                    aria-label={`${logo.name} on dark`}
                  >
                    {logo.name}
                  </div>
                  <div
                    className="grid h-16 place-items-center rounded-sm border border-border bg-canvas text-caption"
                    aria-label={`${logo.name} on light`}
                  >
                    {logo.name}
                  </div>
                </div>
                {logo.lowContrastOnDark ? (
                  <p className="flex items-center gap-1 text-caption text-warning">
                    <TriangleAlertIcon aria-hidden className="size-3.5" /> Low contrast on the dark
                    theme
                  </p>
                ) : null}
                <div className="flex items-center justify-between gap-2 text-body-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{logo.name}</span>
                    {logo.url ? (
                      <span className="block truncate text-caption text-fg-muted">{logo.url}</span>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-1">
                    <Switch
                      id={`lg-${logo.id}`}
                      size="sm"
                      checked={logo.published}
                      onCheckedChange={(v) =>
                        setLogos((ls) =>
                          ls.map((x) => (x.id === logo.id ? { ...x, published: v } : x)),
                        )
                      }
                      aria-label={`Published: ${logo.name}`}
                    />
                    <RowActions
                      label={`Actions for ${logo.name}`}
                      actions={[
                        { label: "Edit", onSelect: () => setLEdit(logo) },
                        { label: "Move up", disabled: i === 0 },
                        { label: "Move down", disabled: i === logos.length - 1 },
                        { label: "Delete", destructive: true, separatorBefore: true },
                      ]}
                    />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>

      <Sheet open={tEdit !== null} onOpenChange={(o) => !o && setTEdit(null)}>
        <SheetContent className="overflow-y-auto lg:w-[560px]">
          <SheetHeader>
            <SheetTitle>{t ? "Edit testimonial" : "New testimonial"}</SheetTitle>
            <SheetDescription>Only publish quotes you have permission to use.</SheetDescription>
          </SheetHeader>
          <form className="space-y-4 px-4" onSubmit={(e) => e.preventDefault()}>
            <Field id="tm-quote" label="Quote" required hint="500 chars">
              <Textarea id="tm-quote" rows={4} maxLength={500} defaultValue={t?.quote} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="tm-author" label="Author name" required>
                <Input id="tm-author" defaultValue={t?.author} />
              </Field>
              <Field id="tm-title" label="Author title" optional>
                <Input id="tm-title" defaultValue={t?.title} />
              </Field>
              <Field id="tm-company" label="Company" optional>
                <Input id="tm-company" defaultValue={t?.company} />
              </Field>
              <Field id="tm-avatar" label="Avatar alt" optional>
                <Input id="tm-avatar" placeholder="Portrait of …" />
              </Field>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-body-sm font-semibold">Context</legend>
              <RadioGroup defaultValue={t?.context ?? "site"} className="flex gap-6">
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="tm-ctx-site" value="site" />
                  <Label htmlFor="tm-ctx-site">Site</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem id="tm-ctx-product" value="product" />
                  <Label htmlFor="tm-ctx-product">Product</Label>
                </div>
              </RadioGroup>
            </fieldset>
            <Field id="tm-product" label="Product" optional>
              <Select defaultValue={t?.product}>
                <SelectTrigger id="tm-product">
                  <SelectValue placeholder="Choose product" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <div className="flex items-center gap-2">
              <Switch id="tm-pub" defaultChecked={t?.published ?? false} />
              <Label htmlFor="tm-pub">Published</Label>
            </div>
          </form>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setTEdit(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success("Testimonial saved");
                setTEdit(null);
              }}
            >
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={lEdit !== null} onOpenChange={(o) => !o && setLEdit(null)}>
        <SheetContent className="overflow-y-auto lg:w-[520px]">
          <SheetHeader>
            <SheetTitle>{l ? `Edit ${l.name}` : "New logo"}</SheetTitle>
            <SheetDescription>
              SVG or PNG, transparent recommended; alt text = name.
            </SheetDescription>
          </SheetHeader>
          <form className="space-y-4 px-4" onSubmit={(e) => e.preventDefault()}>
            <Field id="lg-name" label="Name" required>
              <Input id="lg-name" defaultValue={l?.name} />
            </Field>
            <div
              className={cn(
                "rounded-lg border-2 border-dashed border-border-strong p-6 text-center text-body-sm text-fg-muted",
              )}
            >
              <UploadIcon aria-hidden className="mx-auto mb-1 size-6" />
              Logo image *
            </div>
            <Field id="lg-url" label="Link URL" optional>
              <Input id="lg-url" type="url" defaultValue={l?.url} />
            </Field>
            <div className="flex items-center gap-2">
              <Switch id="lg-pub" defaultChecked={l?.published ?? true} />
              <Label htmlFor="lg-pub">Published</Label>
            </div>
          </form>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setLEdit(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success("Logo saved");
                setLEdit(null);
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
