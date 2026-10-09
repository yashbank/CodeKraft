"use client";

import * as React from "react";
import { PlusIcon, UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

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
import { Banner } from "../Banner";
import { initials } from "../format";
import { Field } from "../RichTextField";
import { RowActions } from "../RowActions";
import type { ClientLogo, TestimonialItem } from "../types";
import { ContentEditorFrame } from "./ContentEditorFrame";
import {
  removeClientLogo,
  removeTestimonial,
  saveClientLogo,
  saveTestimonial,
} from "@/modules/content/admin-mutations";

type LogoRow = ClientLogo & { mediaId?: string };
type LogoUpload = { mediaId: string; url?: string };

/** SCR-ADM-26 — site/product testimonials grid and the client-logo grid, each with an editor sheet. */
export function TestimonialsLogos({
  testimonials: initialTestimonials,
  logos: initialLogos,
  products,
  initialTab = "testimonials",
}: {
  testimonials: TestimonialItem[];
  logos: LogoRow[];
  products: string[];
  initialTab?: "testimonials" | "logos";
}) {
  const router = useRouter();
  const [context, setContext] = React.useState<"site" | "product">("site");
  const [testimonials, setTestimonials] = React.useState(initialTestimonials);
  const [logos, setLogos] = React.useState(initialLogos);
  const [tEdit, setTEdit] = React.useState<TestimonialItem | "new" | null>(null);
  const [lEdit, setLEdit] = React.useState<LogoRow | "new" | null>(null);
  const [tContext, setTContext] = React.useState<"site" | "product">("site");
  const [tProduct, setTProduct] = React.useState<string | undefined>(undefined);
  const [tPublished, setTPublished] = React.useState(false);
  const [lPublished, setLPublished] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [lUpload, setLUpload] = React.useState<LogoUpload | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const items = testimonials.filter((t) => t.context === context);
  const t = tEdit && tEdit !== "new" ? tEdit : null;
  const l = lEdit && lEdit !== "new" ? lEdit : null;
  const tFormRef = React.useRef<HTMLFormElement>(null);
  const lFormRef = React.useRef<HTMLFormElement>(null);

  function openTEdit(item: TestimonialItem | "new") {
    setTEdit(item);
    const row = item === "new" ? null : item;
    setTContext(row?.context ?? "site");
    setTProduct(row?.product);
    setTPublished(row?.published ?? false);
  }

  function openLEdit(logo: LogoRow | "new") {
    setLEdit(logo);
    setLUpload(null);
    setLPublished(logo === "new" ? true : logo.published);
  }

  async function handleSaveTestimonial() {
    const form = tFormRef.current;
    if (!form) return;
    const data = new FormData(form);
    setSaving(true);
    const result = await saveTestimonial({
      id: t?.id,
      quote: String(data.get("quote") ?? "").trim(),
      authorName: String(data.get("author") ?? "").trim(),
      authorTitle: String(data.get("title") ?? "").trim() || undefined,
      company: String(data.get("company") ?? "").trim() || undefined,
      context: tContext,
      productId: undefined,
      position: testimonials.length,
      published: tPublished,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Testimonial saved");
    setTEdit(null);
    router.refresh();
  }

  async function handleDeleteTestimonial(item: TestimonialItem) {
    const result = await removeTestimonial({ id: item.id });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setTestimonials((l2) => l2.filter((x) => x.id !== item.id));
    toast.success("Testimonial deleted");
    router.refresh();
  }

  async function handleLogoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { uploadMediaFile } = await import("@/lib/admin/media-upload");
      const up = await uploadMediaFile(file, "content_media");
      setLUpload({ mediaId: up.mediaId, url: up.url ?? URL.createObjectURL(file) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSaveLogo() {
    const form = lFormRef.current;
    if (!form) return;
    const mediaId = lUpload?.mediaId ?? l?.mediaId;
    if (!mediaId) {
      toast.error("Upload a logo image first.");
      return;
    }
    const data = new FormData(form);
    setSaving(true);
    const result = await saveClientLogo({
      id: l?.id,
      name: String(data.get("name") ?? "").trim(),
      mediaId,
      url: String(data.get("url") ?? "").trim() || undefined,
      position: logos.length,
      published: lPublished,
    });
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Logo saved");
    setLEdit(null);
    router.refresh();
  }

  async function toggleLogoPublished(logo: LogoRow, v: boolean) {
    if (!logo.mediaId) {
      toast.error("This logo has no image on file yet — edit isn't available.");
      return;
    }
    setLogos((ls) => ls.map((x) => (x.id === logo.id ? { ...x, published: v } : x)));
    const result = await saveClientLogo({
      id: logo.id,
      name: logo.name,
      mediaId: logo.mediaId,
      url: logo.url,
      position: logos.findIndex((x) => x.id === logo.id),
      published: v,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      setLogos((ls) => ls.map((x) => (x.id === logo.id ? { ...x, published: !v } : x)));
    } else {
      router.refresh();
    }
  }

  async function handleDeleteLogo(logo: LogoRow) {
    const result = await removeClientLogo({ id: logo.id });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setLogos((ls) => ls.filter((x) => x.id !== logo.id));
    toast.success("Logo deleted");
    router.refresh();
  }

  return (
    <ContentEditorFrame
      title="Testimonials & logos"
      description="Curated by admins; there are no public reviews or ratings (X-007). Only publish quotes you have permission to use."
      wide
      hideSaveBar
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
            <Button size="sm" onClick={() => openTEdit("new")}>
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
                <p className="line-clamp-3 text-body">&ldquo;{item.quote}&rdquo;</p>
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
                      checked={item.published}
                      onCheckedChange={async (v) => {
                        setTestimonials((l2) =>
                          l2.map((x) => (x.id === item.id ? { ...x, published: v } : x)),
                        );
                        const result = await saveTestimonial({
                          id: item.id,
                          quote: item.quote,
                          authorName: item.author,
                          authorTitle: item.title,
                          company: item.company,
                          context: item.context,
                          position: 0,
                          published: v,
                        });
                        if (!result.ok) {
                          toast.error(result.error.message);
                          setTestimonials((l2) =>
                            l2.map((x) => (x.id === item.id ? { ...x, published: !v } : x)),
                          );
                        } else {
                          router.refresh();
                        }
                      }}
                      aria-label={`Published: ${item.author}`}
                    />
                    <RowActions
                      label={`Actions for testimonial by ${item.author}`}
                      actions={[
                        { label: "Edit", onSelect: () => openTEdit(item) },
                        {
                          label: "Delete",
                          destructive: true,
                          onSelect: () => handleDeleteTestimonial(item),
                        },
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
            <Button size="sm" onClick={() => openLEdit("new")}>
              <PlusIcon aria-hidden /> Add logo
            </Button>
          </div>
          <ul
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 tv:grid-cols-4"
            aria-label="Client logos"
          >
            {logos.map((logo) => (
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
                      onCheckedChange={(v) => toggleLogoPublished(logo, v)}
                      aria-label={`Published: ${logo.name}`}
                    />
                    <RowActions
                      label={`Actions for ${logo.name}`}
                      actions={[
                        { label: "Edit", onSelect: () => openLEdit(logo) },
                        {
                          label: "Delete",
                          destructive: true,
                          separatorBefore: true,
                          onSelect: () => handleDeleteLogo(logo),
                        },
                      ]}
                    />
                  </span>
                </div>
              </li>
            ))}
            {logos.length === 0 ? (
              <li className="text-body-sm text-fg-muted">No client logos yet</li>
            ) : null}
          </ul>
        </TabsContent>
      </Tabs>

      <Sheet open={tEdit !== null} onOpenChange={(o) => !o && setTEdit(null)}>
        <SheetContent className="overflow-y-auto lg:w-[560px]">
          <SheetHeader>
            <SheetTitle>{t ? "Edit testimonial" : "New testimonial"}</SheetTitle>
            <SheetDescription>Only publish quotes you have permission to use.</SheetDescription>
          </SheetHeader>
          <form ref={tFormRef} className="space-y-4 px-4" onSubmit={(e) => e.preventDefault()}>
            <Field id="tm-quote" label="Quote" required hint="1000 chars">
              <Textarea
                id="tm-quote"
                name="quote"
                rows={4}
                maxLength={1000}
                defaultValue={t?.quote}
                required
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="tm-author" label="Author name" required>
                <Input id="tm-author" name="author" defaultValue={t?.author} required />
              </Field>
              <Field id="tm-title" label="Author title" optional>
                <Input id="tm-title" name="title" defaultValue={t?.title} />
              </Field>
              <Field id="tm-company" label="Company" optional>
                <Input id="tm-company" name="company" defaultValue={t?.company} />
              </Field>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-body-sm font-semibold">Context</legend>
              <RadioGroup
                value={tContext}
                onValueChange={(v) => setTContext(v as "site" | "product")}
                className="flex gap-6"
              >
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
            {tContext === "product" ? (
              <Field
                id="tm-product"
                label="Product"
                optional
                hint="Product-scoped testimonials aren't linked here yet — edit them from the product editor."
              >
                <Select value={tProduct} onValueChange={setTProduct} disabled>
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
            ) : null}
            <div className="flex items-center gap-2">
              <Switch id="tm-pub" checked={tPublished} onCheckedChange={setTPublished} />
              <Label htmlFor="tm-pub">Published</Label>
            </div>
          </form>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setTEdit(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTestimonial} disabled={saving}>
              {saving ? "Saving…" : "Save"}
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
          <form ref={lFormRef} className="space-y-4 px-4" onSubmit={(e) => e.preventDefault()}>
            <Field id="lg-name" label="Name" required>
              <Input id="lg-name" name="name" defaultValue={l?.name} required />
            </Field>
            <input
              ref={logoInputRef}
              type="file"
              className="sr-only"
              accept="image/*"
              aria-label="Logo image file"
              onChange={handleLogoChosen}
            />
            <div className="flex items-center gap-3">
              {(lUpload?.url ?? l?.logoUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element -- admin preview of a user-uploaded R2 URL
                <img
                  src={lUpload?.url ?? l?.logoUrl}
                  alt=""
                  className="h-16 w-28 rounded-md border border-border bg-surface object-contain p-1"
                />
              ) : (
                <div className="grid h-16 w-28 place-items-center rounded-md border border-dashed border-warning text-caption text-warning">
                  Required
                </div>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                loading={uploading}
                onClick={() => logoInputRef.current?.click()}
              >
                <UploadIcon aria-hidden /> {lUpload || l?.mediaId ? "Replace logo" : "Upload logo"}
              </Button>
            </div>
            <Field id="lg-url" label="Link URL" optional>
              <Input id="lg-url" name="url" type="url" defaultValue={l?.url} />
            </Field>
            <div className="flex items-center gap-2">
              <Switch id="lg-pub" checked={lPublished} onCheckedChange={setLPublished} />
              <Label htmlFor="lg-pub">Published</Label>
            </div>
          </form>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setLEdit(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLogo} disabled={saving || !(lUpload?.mediaId ?? l?.mediaId)}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ContentEditorFrame>
  );
}
