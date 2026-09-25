"use client";

import Link from "next/link";
import * as React from "react";
import {
  ArrowLeftIcon,
  CheckIcon,
  CircleIcon,
  ExternalLinkIcon,
  GripVerticalIcon,
  PlusIcon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/components/ui/_utils";
import { ApprovalGateNotice, Banner } from "../Banner";
import { formatDate, formatDateTime, money, percentFromBps } from "../format";
import { RowActions } from "../RowActions";
import { Field, RichTextField } from "../RichTextField";
import type { ProductEditorData, ProductFlag } from "../types";
import { SplitEditor, splitSummary, type SplitValue } from "./SplitEditor";

const TABS = [
  ["basics", "Basics"],
  ["content", "Content"],
  ["media", "Media"],
  ["offerings", "Offerings & prices"],
  ["delivery", "Delivery config"],
  ["ownership", "Ownership / split"],
  ["seo", "SEO"],
  ["blog", "Blog"],
  ["versions", "Versions"],
  ["testimonials", "Testimonials"],
  ["faqs", "FAQs"],
  ["publish", "Publish / schedule"],
] as const;
type TabKey = (typeof TABS)[number][0];

const FLAGS: Array<{ key: ProductFlag; label: string; hint: string }> = [
  { key: "is_featured", label: "Featured", hint: "Shown on the landing page." },
  {
    key: "is_unlisted",
    label: "Unlisted",
    hint: "Excluded from listings, search and sitemap; direct link only.",
  },
  { key: "is_coming_soon", label: "Coming soon", hint: "Hides the Buy button; shows Notify me." },
  { key: "is_refundable", label: "Refundable", hint: "Enables refund proposals for this product." },
  {
    key: "tax_enabled",
    label: "Tax enabled",
    hint: "Tax applies only once a GSTIN is configured in Settings (BR-08).",
  },
];

export interface ProductEditorProps {
  product: ProductEditorData;
  approvers: string[];
  listHref: string;
  approvalsHref: string;
  /** Currencies enabled in Settings; base first. */
  currencies: string[];
  gstinConfigured: boolean;
  initialTab?: TabKey;
  isNew?: boolean;
}

/**
 * SCR-ADM-04 — the product editor: sticky header with autosave status and approval chip, 220 px
 * vertical tab rail with completeness ticks, and the twelve tab panels.
 */
export function ProductEditor({
  product,
  approvers,
  listHref,
  approvalsHref,
  currencies,
  gstinConfigured,
  initialTab = "basics",
  isNew = false,
}: ProductEditorProps) {
  const [tab, setTab] = React.useState<TabKey>(initialTab);
  const [flags, setFlags] = React.useState<ReadonlySet<ProductFlag>>(new Set(product.flags));
  const [slug, setSlug] = React.useState(product.slug);
  const [offeringSheet, setOfferingSheet] = React.useState(false);
  const [proposing, setProposing] = React.useState(false);
  const active = product.ownership.find((o) => o.status === "active");
  const pendingOwnership = product.ownership.find((o) => o.status === "pending");
  const [split, setSplit] = React.useState<SplitValue>({
    companyCutBps: active?.companyCutBps ?? 10000,
    lines: active?.lines ?? [],
  });

  const complete: Record<TabKey, boolean> = {
    basics: true,
    content: product.description.length > 0,
    media: product.media.some((m) => m.kind === "image"),
    offerings: product.offerings.length > 0,
    delivery: product.offerings.length > 0,
    ownership: Boolean(active),
    seo: product.seo.title.length > 0,
    blog: product.blog.status === "published",
    versions: product.versions.length > 0,
    testimonials: product.testimonials.length > 0,
    faqs: product.faqs.length > 0,
    publish: product.status === "published",
  };

  return (
    <div className="-mx-4 -mt-6 lg:-mx-6">
      <header className="sticky top-[calc(var(--admin-top)+3.5rem)] z-(--ck-z-sticky) flex flex-wrap items-center gap-3 border-b border-border bg-canvas px-4 py-3 lg:px-6">
        <Button asChild variant="ghost" size="sm">
          <Link href={listHref}>
            <ArrowLeftIcon aria-hidden /> Products
          </Link>
        </Button>
        <h1 className="text-h3">{isNew ? "New product" : product.name}</h1>
        <StatusBadge kind="products.status" value={product.status} />
        {product.approval && product.approval.status === "pending" ? (
          <Link href={approvalsHref}>
            <StatusBadge kind="approval_requests.status" value="pending" size="sm" />
          </Link>
        ) : null}
        <span className="text-caption text-fg-muted" aria-live="polite">
          Saved {product.savedAgoSeconds} s ago
        </span>
        <span className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm">
            <ExternalLinkIcon aria-hidden /> Preview
          </Button>
          <Button size="sm" onClick={() => setTab("publish")}>
            {product.status === "published" ? "Schedule update" : "Submit for approval"}
          </Button>
          <RowActions
            label="More product actions"
            actions={[
              { label: "Unpublish", disabled: product.status !== "published" },
              { label: "Request archive" },
              { label: "Request delete", destructive: true },
              { label: "Duplicate as draft", separatorBefore: true },
            ]}
          />
        </span>
      </header>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as TabKey)}
        orientation="vertical"
        className="gap-6 px-4 py-6 lg:px-6"
      >
        <TabsList
          aria-label="Product editor sections"
          className="h-fit w-[220px] shrink-0 flex-col items-stretch bg-transparent p-0"
        >
          {TABS.map(([key, label], i) => {
            const disabled = isNew && key !== "basics";
            return (
              <TabsTrigger
                key={key}
                value={key}
                disabled={disabled}
                className="justify-start gap-2 data-[state=active]:bg-accent-soft data-[state=active]:text-accent-text"
                aria-label={`${label}, ${complete[key] ? "complete" : "incomplete"}`}
              >
                <span className="w-5 font-mono text-caption text-fg-subtle">{i + 1}</span>
                <span className="flex-1 truncate text-left">{label}</span>
                {complete[key] ? (
                  <CheckIcon aria-hidden className="size-4 text-success" />
                ) : (
                  <CircleIcon aria-hidden className="size-3 text-fg-subtle" />
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <div className="min-w-0 max-w-[960px] flex-1 tv:max-w-[1100px]">
          {isNew ? (
            <Banner tone="info" className="mb-4">
              Save basics first — the other tabs unlock after the first save.
            </Banner>
          ) : null}

          <TabsContent value="basics" className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="p-name" label="Name" required>
                <Input id="p-name" defaultValue={product.name} required aria-required />
              </Field>
              <Field
                id="p-slug"
                label="Slug"
                required
                hint={
                  product.status === "published" && slug !== product.slug
                    ? "The old slug will redirect (301)."
                    : "Auto-generated from the name; editable."
                }
              >
                <Input
                  id="p-slug"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="font-mono"
                />
              </Field>
            </div>
            <Field
              id="p-short"
              label="Short description"
              required
              hint={`${product.shortDescription.length}/160`}
            >
              <Textarea
                id="p-short"
                defaultValue={product.shortDescription}
                maxLength={160}
                rows={2}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="p-category" label="Category">
                <Select defaultValue={product.category}>
                  <SelectTrigger id="p-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={product.category}>{product.category}</SelectItem>
                    <SelectItem value="SaaS › Finance">SaaS › Finance</SelectItem>
                    <SelectItem value="Downloads › Finance">Downloads › Finance</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field id="p-tags" label="Tags" hint="Enter to add, Backspace to remove.">
                <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2 py-1">
                  {product.tags.map((t) => (
                    <Badge key={t} tone="neutral">
                      {t}
                    </Badge>
                  ))}
                  <Input id="p-tags" placeholder="Add tag" className="h-7 w-32 border-0 px-1" />
                </div>
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="p-status" label="Status">
                <Input id="p-status" readOnly value={product.status} />
              </Field>
              <Field id="p-version" label="Current version">
                <Input
                  id="p-version"
                  readOnly
                  value={product.currentVersion}
                  className="font-mono"
                />
              </Field>
            </div>
            <fieldset className="space-y-3">
              <legend className="text-body-sm font-semibold">Flags</legend>
              {FLAGS.map((f) => (
                <div key={f.key} className="flex items-start gap-3">
                  <Switch
                    id={`flag-${f.key}`}
                    checked={flags.has(f.key)}
                    onCheckedChange={(v) =>
                      setFlags((prev) => {
                        const n = new Set(prev);
                        if (v) n.add(f.key);
                        else n.delete(f.key);
                        return n;
                      })
                    }
                  />
                  <div>
                    <Label htmlFor={`flag-${f.key}`}>{f.label}</Label>
                    <p className="text-caption text-fg-muted">{f.hint}</p>
                  </div>
                </div>
              ))}
            </fieldset>
          </TabsContent>

          <TabsContent value="content" className="space-y-5">
            <RichTextField
              id="p-desc"
              label="Rich description"
              required
              defaultValue={product.description}
              rows={6}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              {(["Features", "Benefits", "Target audience", "Use cases"] as const).map((list) => (
                <ListEditor
                  key={list}
                  id={`p-list-${list}`}
                  label={list}
                  items={
                    list === "Features"
                      ? product.features
                      : list === "Benefits"
                        ? product.benefits
                        : []
                  }
                />
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="p-industry" label="Industry">
                <Input id="p-industry" placeholder="Add industries" />
              </Field>
              <Field id="p-tech" label="Tech stack">
                <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2 py-1">
                  {product.techStack.map((t) => (
                    <Badge key={t} tone="accent">
                      {t}
                    </Badge>
                  ))}
                  <Input id="p-tech" placeholder="Add" className="h-7 w-24 border-0 px-1" />
                </div>
              </Field>
            </div>
            <RichTextField id="p-req" label="Requirements" rows={3} />
            <Field
              id="p-demo"
              label="Live demo URL"
              optional
              hint={
                flags.has("is_unlisted")
                  ? undefined
                  : "Shown as “Try the demo” on the product page (D-805)."
              }
            >
              <Input id="p-demo" type="url" defaultValue={product.liveDemoUrl} />
            </Field>
            {flags.has("is_unlisted") ? (
              <Banner tone="warning">
                A live-demo URL of an unlisted product is public once known.
              </Banner>
            ) : null}
          </TabsContent>

          <TabsContent value="media" className="space-y-5">
            <div className="rounded-lg border-2 border-dashed border-border-strong p-8 text-center">
              <UploadIcon aria-hidden className="mx-auto size-8 text-fg-subtle" />
              <p className="mt-2 text-body">
                Drop images, screenshots, video (≤ 200 MB), presentation PDF or attachments
              </p>
              <p className="text-caption text-fg-muted">
                Alt text is required for every image. Uploads use presigned PUT with progress.
              </p>
              <Button variant="secondary" size="sm" className="mt-3">
                Choose files
              </Button>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-caption text-fg-muted">
                <span>Storage</span>
                <span className="font-mono tnum">
                  {product.storageUsedMb} MB / {product.storageCapMb} MB
                </span>
              </div>
              <Progress
                value={(product.storageUsedMb / product.storageCapMb) * 100}
                aria-label="Storage used"
              />
            </div>
            <ul className="space-y-2">
              {product.media.map((m, i) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface p-3"
                >
                  <button
                    type="button"
                    aria-label={`Reorder ${m.fileName}`}
                    className="cursor-grab text-fg-subtle"
                  >
                    <GripVerticalIcon aria-hidden className="size-4" />
                  </button>
                  <span
                    aria-hidden
                    className="grid size-12 place-items-center rounded-sm bg-elevated text-caption text-fg-subtle"
                  >
                    {m.kind === "video_embed" ? "▶" : m.kind === "presentation" ? "PDF" : "IMG"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-body-sm">{m.fileName}</span>
                    <span className="block text-caption text-fg-muted">
                      {m.sizeKb > 0 ? `${m.sizeKb} KB` : "embed"}
                    </span>
                  </span>
                  <div className="w-40 space-y-1">
                    <Label htmlFor={`media-kind-${m.id}`} className="text-caption text-fg-muted">
                      Kind
                    </Label>
                    <Select defaultValue={m.kind}>
                      <SelectTrigger id={`media-kind-${m.id}`} size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "image",
                          "screenshot",
                          "gallery",
                          "video_embed",
                          "video_file",
                          "presentation",
                          "attachment",
                          "og",
                        ].map((k) => (
                          <SelectItem key={k} value={k}>
                            {k.replace("_", " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {m.kind === "image" || m.kind === "screenshot" ? (
                    <div className="w-64 space-y-1">
                      <Label
                        htmlFor={`media-alt-${m.id}`}
                        className="text-caption text-fg-muted"
                        required
                      >
                        Alt text
                      </Label>
                      <Input
                        id={`media-alt-${m.id}`}
                        defaultValue={m.alt}
                        className="h-8"
                        required
                        aria-required
                      />
                    </div>
                  ) : null}
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${m.fileName} up`}
                      disabled={i === 0}
                    >
                      ↑
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Move ${m.fileName} down`}
                      disabled={i === product.media.length - 1}
                    >
                      ↓
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
            <Field
              id="p-video-url"
              label="Video embed URL"
              optional
              hint="YouTube or Vimeo (D-309)."
            >
              <Input id="p-video-url" type="url" placeholder="https://youtube.com/watch?v=…" />
            </Field>
          </TabsContent>

          <TabsContent value="offerings" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-body-sm text-fg-muted">
                “Offering”, never “plan” or “tier”. Prices are stored in minor units per enabled
                currency.
              </p>
              <Button size="sm" onClick={() => setOfferingSheet(true)}>
                <PlusIcon aria-hidden /> Add offering
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Purchase model</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead className="text-right">Base price</TableHead>
                    <TableHead>Methods</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.offerings.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.name}</TableCell>
                      <TableCell>
                        <StatusBadge
                          kind="offerings.purchase_model"
                          value={o.purchaseModel}
                          size="sm"
                        />
                      </TableCell>
                      <TableCell>
                        {o.billingInterval ? (
                          <StatusBadge
                            kind="offerings.billing_interval"
                            value={o.billingInterval}
                            size="sm"
                          />
                        ) : (
                          <span className="text-fg-subtle">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tnum">
                        {o.purchaseModel === "custom_quote" ? "Quote" : money(o.basePrice)}
                        {o.compareAt ? (
                          <span className="block text-caption text-fg-subtle line-through">
                            {money(o.compareAt)}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-fg-muted">
                        {o.methods.map((m) => (m === "upi" ? "UPI" : "Bank")).join(" · ")}
                      </TableCell>
                      <TableCell>
                        <StatusBadge kind="offerings.status" value={o.status} size="sm" />
                      </TableCell>
                      <TableCell>{o.isDefault ? "★ Default" : ""}</TableCell>
                      <TableCell>
                        <RowActions
                          label={`Actions for ${o.name}`}
                          actions={[
                            { label: "Edit", onSelect: () => setOfferingSheet(true) },
                            { label: "Set as default" },
                            { label: "Deactivate" },
                            { label: "Delete", destructive: true, disabled: true },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-caption text-fg-muted">
              Delete is blocked when entitlements exist — deactivate instead.
            </p>
          </TabsContent>

          <TabsContent value="delivery" className="space-y-4">
            <Accordion type="multiple" defaultValue={[product.offerings[0]?.id ?? ""]}>
              {product.offerings.map((o) => (
                <AccordionItem key={o.id} value={o.id}>
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      {o.name}{" "}
                      <StatusBadge
                        kind="offerings.delivery_type"
                        value={o.deliveryType}
                        size="sm"
                      />
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="grid gap-4 sm:grid-cols-2">
                    <Field id={`dl-type-${o.id}`} label="Delivery type" required>
                      <Select defaultValue={o.deliveryType}>
                        <SelectTrigger id={`dl-type-${o.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["saas", "hosted", "download", "license", "service", "custom"].map(
                            (t) => (
                              <SelectItem key={t} value={t}>
                                {t}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field id={`dl-prov-${o.id}`} label="Provisioning">
                      <Select defaultValue="manual">
                        <SelectTrigger id={`dl-prov-${o.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="automated" disabled>
                            Automated (V2)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field id={`dl-access-${o.id}`} label="Access period">
                      <Select defaultValue={o.purchaseModel === "subscription" ? "12" : "lifetime"}>
                        <SelectTrigger id={`dl-access-${o.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lifetime">Lifetime</SelectItem>
                          <SelectItem value="12">12 months</SelectItem>
                          <SelectItem value="1">1 month</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field id={`dl-update-${o.id}`} label="Update policy">
                      <Select defaultValue="all_free">
                        <SelectTrigger id={`dl-update-${o.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_free">All updates</SelectItem>
                          <SelectItem value="during_access">Updates during access</SelectItem>
                          <SelectItem value="major_paid">Major versions paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    {o.deliveryType === "download" ? (
                      <Field id={`dl-cap-${o.id}`} label="Download cap per purchase">
                        <Input
                          id={`dl-cap-${o.id}`}
                          inputMode="numeric"
                          defaultValue="5"
                          className="w-24 font-mono"
                        />
                      </Field>
                    ) : null}
                    {o.deliveryType === "service" ? (
                      <div className="sm:col-span-2">
                        <ListEditor
                          id={`dl-steps-${o.id}`}
                          label="Service checklist steps"
                          items={[
                            "Kick-off call",
                            "SSO configured",
                            "Data imported",
                            "Training session",
                            "Handover",
                          ]}
                        />
                      </div>
                    ) : null}
                    <div className="sm:col-span-2">
                      <RichTextField
                        id={`dl-post-${o.id}`}
                        label="Post-purchase instructions"
                        rows={3}
                        hint="Shown in the customer dashboard after payment (A-601)."
                      />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          <TabsContent value="ownership" className="space-y-5">
            <Banner tone="neutral">
              Ownership is never visible to buyers (BR-02). Percentages shown with two decimals;
              stored as basis points.
            </Banner>
            {pendingOwnership ? (
              <Banner tone="warning" title="Proposal awaiting approval">
                v{pendingOwnership.version} ·{" "}
                {splitSummary({
                  companyCutBps: pendingOwnership.companyCutBps,
                  lines: pendingOwnership.lines,
                })}{" "}
                · approver {approvers[0]}
              </Banner>
            ) : null}
            {active ? (
              <div className="rounded-lg border border-border bg-surface p-4">
                <div className="mb-3 flex items-center gap-2">
                  <h2 className="text-h4">Active split · v{active.version}</h2>
                  <StatusBadge kind="product_ownerships.status" value="active" size="sm" />
                  <span className="text-caption text-fg-muted">
                    effective from {formatDate(active.effectiveFrom)}
                  </span>
                </div>
                <dl className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <dt className="text-caption text-fg-muted">Company cut</dt>
                    <dd className="font-mono text-body tnum">
                      {percentFromBps(active.companyCutBps)}
                    </dd>
                  </div>
                  {active.lines.map((l) => (
                    <div key={l.partnerId}>
                      <dt className="text-caption text-fg-muted">{l.partnerName}</dt>
                      <dd className="font-mono text-body tnum">{percentFromBps(l.bps)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
            <div className="rounded-lg border border-border bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Split</TableHead>
                    <TableHead>Effective</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.ownership.map((o) => (
                    <TableRow key={o.version}>
                      <TableCell className="font-mono">v{o.version}</TableCell>
                      <TableCell>
                        {splitSummary({ companyCutBps: o.companyCutBps, lines: o.lines })}
                      </TableCell>
                      <TableCell>{formatDate(o.effectiveFrom)}</TableCell>
                      <TableCell>
                        <StatusBadge kind="product_ownerships.status" value={o.status} size="sm" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {proposing ? (
              <form
                className="space-y-4 rounded-lg border border-accent bg-surface p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  toast.success(`Approval requested — waiting for ${approvers[0]}`);
                  setProposing(false);
                }}
              >
                <h2 className="text-h4">Propose new split</h2>
                <SplitEditor
                  idPrefix="own"
                  value={split}
                  onChange={setSplit}
                  partners={product.partners}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="own-effective" label="Effective date" required>
                    <Input id="own-effective" type="date" defaultValue="2026-10-01" />
                  </Field>
                  <Field id="own-comment" label="Comment to approver" required>
                    <Input id="own-comment" required aria-required />
                  </Field>
                </div>
                <ApprovalGateNotice approvers={approvers} what="Changing ownership" />
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={
                      split.companyCutBps + split.lines.reduce((s, l) => s + l.bps, 0) !== 10000
                    }
                  >
                    Request approval
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setProposing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <Button
                variant="secondary"
                onClick={() => setProposing(true)}
                disabled={Boolean(pendingOwnership)}
              >
                Propose new split
              </Button>
            )}
          </TabsContent>

          <TabsContent value="seo" className="space-y-5">
            <Field id="seo-title" label="SEO title" hint={`${product.seo.title.length}/60`}>
              <Input id="seo-title" defaultValue={product.seo.title} maxLength={60} />
            </Field>
            <Field
              id="seo-desc"
              label="Meta description"
              hint={`${product.seo.description.length}/160`}
            >
              <Textarea
                id="seo-desc"
                defaultValue={product.seo.description}
                maxLength={160}
                rows={2}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="seo-canonical" label="Canonical URL" optional>
                <Input id="seo-canonical" type="url" defaultValue={product.seo.canonical} />
              </Field>
              <Field id="seo-og" label="OG image override" optional>
                <Select>
                  <SelectTrigger id="seo-og">
                    <SelectValue placeholder="Use cover image" />
                  </SelectTrigger>
                  <SelectContent>
                    {product.media
                      .filter((m) => m.kind === "image" || m.kind === "screenshot")
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.fileName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="seo-noindex" checked={flags.has("is_unlisted")} disabled />
              <Label htmlFor="seo-noindex">noindex (automatic for unlisted products)</Label>
            </div>
            <div className="space-y-1">
              <p className="text-body-sm font-semibold">JSON-LD preview</p>
              <pre className="overflow-auto rounded-md bg-canvas p-3 font-mono text-caption text-fg-muted">{`{ "@type": "Product", "name": "${product.name}", "offers": { "@type": "Offer", "priceCurrency": "INR", "price": "999.00" } }`}</pre>
            </div>
          </TabsContent>

          <TabsContent value="blog" className="space-y-5">
            <div className="flex items-center gap-2">
              <StatusBadge kind="product_blogs.status" value={product.blog.status} />
              <Button size="sm" variant="secondary" disabled={product.status !== "published"}>
                {product.blog.status === "published" ? "Unpublish blog" : "Publish blog"}
              </Button>
              {product.status !== "published" ? (
                <span className="text-caption text-fg-muted">
                  Requires the product to be published.
                </span>
              ) : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="blog-title" label="Title" required>
                <Input id="blog-title" defaultValue={product.blog.title} />
              </Field>
              <Field
                id="blog-slug"
                label="Slug"
                required
                hint="/blog/… — changing a published slug writes a 301 redirect."
              >
                <Input id="blog-slug" defaultValue={product.blog.slug} className="font-mono" />
              </Field>
            </div>
            <Field id="blog-excerpt" label="Excerpt">
              <Textarea id="blog-excerpt" defaultValue={product.blog.excerpt} rows={2} />
            </Field>
            <RichTextField id="blog-body" label="Body" rows={8} full />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="blog-seo-title" label="SEO title">
                <Input id="blog-seo-title" />
              </Field>
              <Field id="blog-seo-desc" label="SEO description">
                <Input id="blog-seo-desc" />
              </Field>
            </div>
          </TabsContent>

          <TabsContent value="versions" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-body-sm text-fg-muted">
                Adding a version sets `current_version` and notifies owners per update policy.
              </p>
              <Button size="sm">
                <PlusIcon aria-hidden /> Add version
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Released</TableHead>
                    <TableHead>Files</TableHead>
                    <TableHead>Changelog</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.versions.map((v) => (
                    <TableRow key={v.version}>
                      <TableCell className="font-mono">{v.version}</TableCell>
                      <TableCell>{formatDate(v.releasedAt)}</TableCell>
                      <TableCell>{v.files}</TableCell>
                      <TableCell className="whitespace-normal text-fg-muted">
                        {v.changelog}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="testimonials" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-body-sm text-fg-muted">
                Curated by admins — there are no public reviews (D-312).
              </p>
              <Button size="sm">
                <PlusIcon aria-hidden /> Add testimonial
              </Button>
            </div>
            <ul className="space-y-2">
              {product.testimonials.map((t) => (
                <li
                  key={t.id}
                  className="flex items-start gap-3 rounded-md border border-border bg-surface p-3"
                >
                  <button
                    type="button"
                    aria-label={`Reorder testimonial by ${t.author}`}
                    className="mt-1 cursor-grab text-fg-subtle"
                  >
                    <GripVerticalIcon aria-hidden className="size-4" />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-body">“{t.quote}”</p>
                    <p className="text-caption text-fg-muted">
                      {t.author}
                      {t.title ? `, ${t.title}` : ""}
                      {t.company ? ` · ${t.company}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`tm-${t.id}`}
                      defaultChecked={t.published}
                      aria-label={`Published: ${t.author}`}
                    />
                    <RowActions
                      label={`Actions for testimonial by ${t.author}`}
                      actions={[{ label: "Edit" }, { label: "Delete", destructive: true }]}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="faqs" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-body-sm text-fg-muted">
                Product FAQs feed the assistant&rsquo;s knowledge index.
              </p>
              <Button size="sm">
                <PlusIcon aria-hidden /> Add FAQ
              </Button>
            </div>
            <ul className="space-y-3">
              {product.faqs.map((f, i) => (
                <li key={f.id} className="space-y-2 rounded-md border border-border bg-surface p-3">
                  <Field id={`faq-q-${f.id}`} label={`Question ${i + 1}`} required>
                    <Input id={`faq-q-${f.id}`} defaultValue={f.question} />
                  </Field>
                  <RichTextField
                    id={`faq-a-${f.id}`}
                    label="Answer"
                    required
                    defaultValue={f.answer}
                    rows={2}
                  />
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" disabled={i === 0}>
                      Move up
                    </Button>
                    <Button variant="ghost" size="sm" disabled={i === product.faqs.length - 1}>
                      Move down
                    </Button>
                    <Button variant="ghost" size="sm" className="text-danger">
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </TabsContent>

          <TabsContent value="publish" className="space-y-5">
            <div className="rounded-lg border border-border bg-surface p-4">
              <h2 className="mb-3 text-h4">Readiness checklist</h2>
              <ul className="space-y-2 text-body-sm">
                {[
                  ["Offering with base price and payment method", complete.offerings],
                  ["At least one image with alt text", complete.media],
                  ["Ownership active or pending", complete.ownership],
                  ["SEO title (optional)", complete.seo],
                ].map(([label, ok]) => (
                  <li key={String(label)} className="flex items-center gap-2">
                    {ok ? (
                      <CheckIcon aria-hidden className="size-4 text-success" />
                    ) : (
                      <CircleIcon aria-hidden className="size-3 text-fg-subtle" />
                    )}
                    <span className="sr-only">{ok ? "Done:" : "Missing:"}</span>
                    {label}
                  </li>
                ))}
              </ul>
            </div>
            {flags.has("is_unlisted") ? (
              <Banner tone="neutral">
                Unlisted products are excluded from listings, search and sitemap.
              </Banner>
            ) : null}
            {flags.has("is_coming_soon") ? (
              <Banner tone="warning">Coming soon hides the Buy button.</Banner>
            ) : null}
            {flags.has("tax_enabled") && !gstinConfigured ? (
              <Banner tone="warning">
                Tax applies only once a GSTIN is configured in Settings (BR-08).
              </Banner>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="pub-at"
                label="Publish at"
                optional
                hint="Leave empty to publish on approval (D-307)."
              >
                <Input id="pub-at" type="datetime-local" />
              </Field>
              <Field id="pub-comment" label="Comment to approver" required>
                <Input id="pub-comment" required aria-required />
              </Field>
            </div>
            <ApprovalGateNotice approvers={approvers} what="Publishing" />
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  toast.success(`Submitted for approval — waiting for ${approvers[0]}`)
                }
              >
                Submit for approval
              </Button>
              {product.status === "published" ? <Button variant="outline">Unpublish</Button> : null}
            </div>
            {product.approval ? (
              <div className="rounded-lg border border-border bg-surface p-4">
                <h2 className="mb-2 text-h4">Approval history</h2>
                <p className="flex items-center gap-2 text-body-sm">
                  <StatusBadge
                    kind="approval_requests.status"
                    value={product.approval.status}
                    size="sm"
                  />{" "}
                  by {product.approval.approver} · {formatDateTime(product.approval.at)}
                </p>
              </div>
            ) : null}
          </TabsContent>
        </div>
      </Tabs>

      <Sheet open={offeringSheet} onOpenChange={setOfferingSheet}>
        <SheetContent className="overflow-y-auto lg:w-[640px]">
          <SheetHeader>
            <SheetTitle>Offering</SheetTitle>
            <SheetDescription>
              Prices per enabled currency; the base currency price is mandatory.
            </SheetDescription>
          </SheetHeader>
          <form className="space-y-4 px-4" onSubmit={(e) => e.preventDefault()}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="of-name" label="Name" required>
                <Input id="of-name" defaultValue="Team" />
              </Field>
              <Field id="of-slug" label="Slug">
                <Input id="of-slug" defaultValue="team" className="font-mono" />
              </Field>
              <Field id="of-model" label="Purchase model" required>
                <Select defaultValue="subscription">
                  <SelectTrigger id="of-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time</SelectItem>
                    <SelectItem value="subscription">Subscription</SelectItem>
                    <SelectItem value="custom_quote">Custom quote</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field id="of-interval" label="Billing interval">
                <Select defaultValue="annual">
                  <SelectTrigger id="of-interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field id="of-trial" label="Trial days" optional>
                <Input id="of-trial" inputMode="numeric" defaultValue="14" className="font-mono" />
              </Field>
              <Field id="of-license" label="License type" optional>
                <Input id="of-license" defaultValue="Per workspace" />
              </Field>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-body-sm font-semibold">Prices</legend>
              {currencies.map((c, i) => (
                <div key={c} className="grid grid-cols-[64px_1fr_1fr] items-center gap-2">
                  <span className="font-mono text-body-sm">
                    {c}
                    {i === 0 ? " *" : ""}
                  </span>
                  <div>
                    <Label htmlFor={`of-price-${c}`} className="sr-only">{`${c} base price`}</Label>
                    <Input
                      id={`of-price-${c}`}
                      inputMode="decimal"
                      placeholder="Base"
                      className="text-right font-mono tnum"
                      defaultValue={i === 0 ? "9,999.00" : ""}
                      required={i === 0}
                    />
                  </div>
                  <div>
                    <Label
                      htmlFor={`of-compare-${c}`}
                      className="sr-only"
                    >{`${c} compare-at price`}</Label>
                    <Input
                      id={`of-compare-${c}`}
                      inputMode="decimal"
                      placeholder="Compare-at"
                      className="text-right font-mono tnum"
                    />
                  </div>
                </div>
              ))}
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="text-body-sm font-semibold">Enabled payment methods *</legend>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox id="of-upi" defaultChecked />
                  <Label htmlFor="of-upi">UPI</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="of-bank" defaultChecked />
                  <Label htmlFor="of-bank">Bank transfer</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="of-card" disabled />
                  <Label htmlFor="of-card">Cards (flag off)</Label>
                </div>
              </div>
            </fieldset>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch id="of-active" defaultChecked />
                <Label htmlFor="of-active">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="of-default" />
                <Label htmlFor="of-default">Default offering</Label>
              </div>
            </div>
          </form>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={() => setOfferingSheet(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                toast.success("Offering saved");
                setOfferingSheet(false);
              }}
            >
              Save offering
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Repeatable short-line list with keyboard reorder buttons. */
function ListEditor({ id, label, items }: { id: string; label: string; items: string[] }) {
  const [list, setList] = React.useState(items);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-new`}>{label}</Label>
      <ul className="space-y-1">
        {list.map((item, i) => (
          <li key={`${item}-${i}`} className="flex items-center gap-1">
            <Input aria-label={`${label} ${i + 1}`} defaultValue={item} className="h-8" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${label} ${i + 1}`}
              onClick={() => setList((l) => l.filter((_, j) => j !== i))}
            >
              ×
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1">
        <Input
          id={`${id}-new`}
          placeholder={`Add ${label.toLowerCase()}`}
          className={cn("h-8")}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const v = e.currentTarget.value.trim();
              if (v) {
                setList((l) => [...l, v]);
                e.currentTarget.value = "";
              }
            }
          }}
        />
      </div>
    </div>
  );
}
