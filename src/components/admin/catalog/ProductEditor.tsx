"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { fromPlainText, toPlainText } from "@/modules/content/render";
import {
  createProduct,
  proposeOwnershipSplit,
  removeProductFaq,
  removeProductTestimonial,
  reorderProductFaqsList,
  requestProductArchive,
  requestProductDelete,
  saveOffering,
  saveProductFaq,
  saveProductTestimonial,
  setOfferingPaymentMethods,
  setOfferingPrices,
  submitProductForApproval,
  unpublishProduct,
  updateProduct,
} from "@/modules/catalog/admin-mutations";
import { attachProductMedia, detachProductMedia } from "@/modules/media/admin-mutations";
import { ApprovalGateNotice, Banner } from "../Banner";
import { formatDate, formatDateTime, money, percentFromBps } from "../format";
import { RowActions } from "../RowActions";
import { Field, RichTextField } from "../RichTextField";
import type { CategoryNode, FaqItem, ProductEditorData, ProductFlag, TestimonialItem } from "../types";
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

type LifecycleDialogKind = "unpublish" | "archive" | "delete";

/** Mirrors `src/modules/offerings/types.ts` enums — kept as plain literals here (not imported)
 * so this client component doesn't pull in that module's server-only dependency graph. */
const PURCHASE_MODELS = ["one_time", "subscription", "custom_quote"] as const;
const BILLING_INTERVALS = ["monthly", "quarterly", "annual"] as const;
const DELIVERY_TYPES = ["saas", "hosted", "download", "license", "service", "custom"] as const;
const PURCHASE_MODEL_LABEL: Record<(typeof PURCHASE_MODELS)[number], string> = {
  one_time: "One-time",
  subscription: "Subscription",
  custom_quote: "Custom quote",
};
const DELIVERY_TYPE_LABEL: Record<(typeof DELIVERY_TYPES)[number], string> = {
  saas: "SaaS",
  hosted: "Hosted",
  download: "Download",
  license: "License",
  service: "Service",
  custom: "Custom",
};

export interface ProductEditorProps {
  product: ProductEditorData;
  /** Real category tree, for the Basics category picker and its ids. */
  categories: CategoryNode[];
  approvers: string[];
  listHref: string;
  approvalsHref: string;
  /** Currencies enabled in Settings; base first. */
  currencies: string[];
  gstinConfigured: boolean;
  initialTab?: TabKey;
  isNew?: boolean;
}

function flattenCategoryOptions(nodes: CategoryNode[]): Array<{ id: string; label: string }> {
  const out: Array<{ id: string; label: string }> = [];
  for (const c of nodes) {
    out.push({ id: c.id, label: c.name });
    for (const ch of c.children ?? []) out.push({ id: ch.id, label: `${c.name} › ${ch.name}` });
  }
  return out;
}

/**
 * SCR-ADM-04 — the product editor: sticky header with autosave status and approval chip, 220 px
 * vertical tab rail with completeness ticks, and the twelve tab panels.
 *
 * Basics / Content / SEO each save independently (their own form + `updateProduct` patch);
 * FAQs, testimonials and the ownership split each have their own real mutation. Offerings,
 * delivery config, media upload and the blog body/SEO fields are display-only in this pass —
 * see the phase report for exactly what's missing and why.
 */
export function ProductEditor({
  product,
  categories,
  approvers,
  listHref,
  approvalsHref,
  currencies,
  gstinConfigured,
  initialTab = "basics",
  isNew = false,
}: ProductEditorProps) {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>(initialTab);
  const productId = product.id;
  const [expectedUpdatedAt, setExpectedUpdatedAt] = React.useState(product.updatedAt);
  const [flags, setFlags] = React.useState<ReadonlySet<ProductFlag>>(new Set(product.flags));
  const [slug, setSlug] = React.useState(product.slug);
  const [tags, setTags] = React.useState<string[]>(product.tags);
  const [newTag, setNewTag] = React.useState("");
  const [techStack, setTechStack] = React.useState<string[]>(product.techStack);
  const [newTech, setNewTech] = React.useState("");
  const [features, setFeatures] = React.useState<string[]>(product.features);
  const [benefits, setBenefits] = React.useState<string[]>(product.benefits);
  const [faqs, setFaqs] = React.useState<Array<FaqItem & { isNew?: boolean }>>(
    product.faqs.map((f) => ({ ...f })),
  );
  const [testimonials, setTestimonials] = React.useState<
    Array<TestimonialItem & { isNew?: boolean }>
  >(product.testimonials.map((t) => ({ ...t })));
  const [savingTab, setSavingTab] = React.useState<TabKey | null>(null);
  const [lifecycleDialog, setLifecycleDialog] = React.useState<LifecycleDialogKind | null>(null);
  const [lifecycleReason, setLifecycleReason] = React.useState("");
  const [lifecycleBusy, setLifecycleBusy] = React.useState(false);
  const [proposing, setProposing] = React.useState(false);
  const [addOfferingOpen, setAddOfferingOpen] = React.useState(false);
  const [savingOffering, setSavingOffering] = React.useState(false);
  const [offeringPurchaseModel, setOfferingPurchaseModel] =
    React.useState<(typeof PURCHASE_MODELS)[number]>("one_time");
  const [offeringBillingInterval, setOfferingBillingInterval] =
    React.useState<(typeof BILLING_INTERVALS)[number]>("monthly");
  const [offeringDeliveryType, setOfferingDeliveryType] =
    React.useState<(typeof DELIVERY_TYPES)[number]>("download");
  const mediaFileInputRef = React.useRef<HTMLInputElement>(null);
  const [pendingMediaFile, setPendingMediaFile] = React.useState<File | null>(null);
  const [pendingMediaAlt, setPendingMediaAlt] = React.useState("");
  const [uploadingMedia, setUploadingMedia] = React.useState(false);
  const [removingMediaId, setRemovingMediaId] = React.useState<string | null>(null);
  const active = product.ownership.find((o) => o.status === "active");
  const pendingOwnership = product.ownership.find((o) => o.status === "pending");
  const [split, setSplit] = React.useState<SplitValue>({
    companyCutBps: active?.companyCutBps ?? 10000,
    lines: active?.lines ?? [],
  });
  const categoryOptions = flattenCategoryOptions(categories);

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

  function addTag() {
    const v = newTag.trim().toLowerCase();
    if (v && !tags.includes(v)) setTags((l) => [...l, v]);
    setNewTag("");
  }
  function addTech() {
    const v = newTech.trim();
    if (v && !techStack.includes(v)) setTechStack((l) => [...l, v]);
    setNewTech("");
  }

  async function saveBasics(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("name") ?? "").trim();
    const shortDescription = String(data.get("shortDescription") ?? "").trim();
    const categoryId = String(data.get("categoryId") ?? "none");
    if (!name || !slug || !shortDescription) {
      toast.error("Name, slug and short description are required.");
      return;
    }
    setSavingTab("basics");
    if (isNew) {
      const result = await createProduct({
        name,
        slug,
        shortDescription,
        categoryId: categoryId === "none" ? undefined : categoryId,
        tags,
      });
      setSavingTab(null);
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Product created as a draft — continue editing below.");
      router.push(`/admin/products/${result.data.productId}`);
      return;
    }
    const result = await updateProduct({
      productId,
      expectedUpdatedAt,
      patch: {
        name,
        slug,
        shortDescription,
        categoryId: categoryId === "none" ? null : categoryId,
        tags,
        isFeatured: flags.has("is_featured"),
        isUnlisted: flags.has("is_unlisted"),
        isComingSoon: flags.has("is_coming_soon"),
        isRefundable: flags.has("is_refundable"),
        taxEnabled: flags.has("tax_enabled"),
      },
    });
    setSavingTab(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setExpectedUpdatedAt(new Date(result.data.product.updatedAt).toISOString());
    toast.success("Basics saved");
    router.refresh();
  }

  async function saveContent(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isNew) return;
    const data = new FormData(e.currentTarget);
    const description = String(data.get("description") ?? "");
    const liveDemoUrl = String(data.get("liveDemoUrl") ?? "").trim();
    setSavingTab("content");
    const result = await updateProduct({
      productId,
      expectedUpdatedAt,
      patch: {
        descriptionJson: description.trim().length > 0 ? fromPlainText(description) : null,
        features: features.map((title) => ({ title })),
        benefits: benefits.map((title) => ({ title })),
        techStack,
        liveDemoUrl: liveDemoUrl.length > 0 ? liveDemoUrl : null,
      },
    });
    setSavingTab(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setExpectedUpdatedAt(new Date(result.data.product.updatedAt).toISOString());
    toast.success("Content saved");
    router.refresh();
  }

  async function saveSeo(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isNew) return;
    const data = new FormData(e.currentTarget);
    const seoTitle = String(data.get("seoTitle") ?? "").trim();
    const seoDescription = String(data.get("seoDescription") ?? "").trim();
    const canonicalUrl = String(data.get("canonicalUrl") ?? "").trim();
    const ogImageMediaId = String(data.get("ogImageMediaId") ?? "none");
    setSavingTab("seo");
    const result = await updateProduct({
      productId,
      expectedUpdatedAt,
      patch: {
        seoTitle: seoTitle.length > 0 ? seoTitle : null,
        seoDescription: seoDescription.length > 0 ? seoDescription : null,
        canonicalUrl: canonicalUrl.length > 0 ? canonicalUrl : null,
        ogImageMediaId: ogImageMediaId === "none" ? null : ogImageMediaId,
      },
    });
    setSavingTab(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setExpectedUpdatedAt(new Date(result.data.product.updatedAt).toISOString());
    toast.success("SEO saved");
    router.refresh();
  }

  async function confirmLifecycle() {
    if (!lifecycleDialog) return;
    if (lifecycleReason.trim().length === 0) {
      toast.error("A reason is required.");
      return;
    }
    setLifecycleBusy(true);
    const result =
      lifecycleDialog === "unpublish"
        ? await unpublishProduct({ productId, reason: lifecycleReason.trim() })
        : lifecycleDialog === "archive"
          ? await requestProductArchive({ productId, reason: lifecycleReason.trim() })
          : await requestProductDelete({ productId, reason: lifecycleReason.trim() });
    setLifecycleBusy(false);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(
      lifecycleDialog === "unpublish"
        ? "Unpublished"
        : `Approval requested — waiting for ${approvers[0] ?? "another admin"}`,
    );
    setLifecycleDialog(null);
    setLifecycleReason("");
    router.refresh();
  }

  async function submitForApproval(publishAt: string) {
    const result = await submitProductForApproval({
      productId,
      publishAt: publishAt.length > 0 ? new Date(publishAt).toISOString() : undefined,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`Submitted for approval — waiting for ${approvers[0] ?? "another admin"}`);
    router.refresh();
  }

  async function submitOwnershipProposal(effectiveFrom: string) {
    if (split.companyCutBps + split.lines.reduce((s, l) => s + l.bps, 0) !== 10000) return;
    const result = await proposeOwnershipSplit({
      productId,
      companyCutBps: split.companyCutBps,
      lines: split.lines
        .filter((l) => l.partnerId)
        .map((l) => ({ partnerId: l.partnerId, shareBps: l.bps })),
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom).toISOString() : undefined,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`Approval requested — waiting for ${approvers[0] ?? "another admin"}`);
    setProposing(false);
    router.refresh();
  }

  async function handleAddOffering(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get("offeringName") ?? "").trim();
    const priceInput = String(data.get("offeringPrice") ?? "").trim();
    const priceInr = Number(priceInput);
    if (!name || !priceInput || !Number.isFinite(priceInr) || priceInr <= 0) {
      toast.error("Name and a price above 0 are required.");
      return;
    }
    const slugified = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    setSavingOffering(true);
    const isDefault = product.offerings.length === 0;

    const upsertResult = await saveOffering({
      productId,
      name,
      slug: slugified || `offering-${Date.now()}`,
      position: product.offerings.length,
      isDefault,
      purchaseModel: offeringPurchaseModel,
      ...(offeringPurchaseModel === "subscription" ? { billingInterval: offeringBillingInterval } : {}),
      deliveryType: offeringDeliveryType,
      deliveryConfig: { provisioning: "manual", updatePolicy: "all_free" },
      ...(offeringDeliveryType === "service"
        ? { serviceSteps: [{ key: "delivery", title: "Delivery" }] }
        : {}),
      status: "active",
    });
    if (!upsertResult.ok) {
      toast.error(upsertResult.error.message);
      setSavingOffering(false);
      return;
    }
    const offeringId = upsertResult.data.offering.id;

    const priceResult = await setOfferingPrices({
      offeringId,
      prices: [{ currency: "INR", amountMinor: Math.round(priceInr * 100) }],
    });
    if (!priceResult.ok) {
      toast.error(priceResult.error.message);
      setSavingOffering(false);
      return;
    }

    const methodsResult = await setOfferingPaymentMethods({
      offeringId,
      methods: ["manual_upi", "manual_bank"],
    });
    if (!methodsResult.ok) {
      toast.error(methodsResult.error.message);
      setSavingOffering(false);
      return;
    }

    setSavingOffering(false);
    setAddOfferingOpen(false);
    toast.success("Offering created");
    router.refresh();
  }

  function mediaKindFor(mime: string): "image" | "video_file" | "presentation" | "attachment" {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video_file";
    if (mime === "application/pdf") return "presentation";
    return "attachment";
  }
  function uploadPurposeFor(mime: string): string {
    if (mime.startsWith("image/")) return "product_image";
    if (mime.startsWith("video/")) return "product_video";
    if (mime === "application/pdf") return "product_presentation";
    return "product_attachment";
  }

  function onMediaFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPendingMediaFile(file);
    setPendingMediaAlt("");
  }

  async function confirmMediaUpload() {
    const file = pendingMediaFile;
    if (!file) return;
    const kind = mediaKindFor(file.type);
    if (kind === "image" && pendingMediaAlt.trim().length === 0) {
      toast.error("Alt text is required for images.");
      return;
    }
    setUploadingMedia(true);
    try {
      const { uploadMediaFile } = await import("@/lib/admin/media-upload");
      const uploaded = await uploadMediaFile(file, uploadPurposeFor(file.type));
      const result = await attachProductMedia({
        productId,
        kind,
        mediaId: uploaded.mediaId,
        alt: pendingMediaAlt.trim(),
        position: product.media.length,
      });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success("Media attached");
      setPendingMediaFile(null);
      setPendingMediaAlt("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function removeMedia(productMediaId: string) {
    setRemovingMediaId(productMediaId);
    const result = await detachProductMedia({ productId, productMediaId });
    setRemovingMediaId(null);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Media removed");
    router.refresh();
  }

  function addFaq() {
    setFaqs((l) => [
      ...l,
      { id: `new-${Date.now()}`, question: "", answer: "", scope: "product", published: true, isNew: true },
    ]);
  }
  function updateFaq(id: string, patch: Partial<FaqItem>) {
    setFaqs((l) => l.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }
  async function saveFaqAt(index: number) {
    const item = faqs[index];
    if (!item) return;
    if (item.question.trim().length === 0 || item.answer.trim().length === 0) {
      toast.error("Question and answer are required.");
      return;
    }
    const result = await saveProductFaq({
      productId,
      faqId: item.isNew ? undefined : item.id,
      question: item.question.trim(),
      answerJson: fromPlainText(item.answer),
      position: index,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setFaqs(
      result.data.faqs.map((f) => ({
        id: f.id,
        question: f.question,
        answer: toPlainText(f.answer as never),
        scope: "product",
        published: true,
      })),
    );
    toast.success("FAQ saved");
    router.refresh();
  }
  async function deleteFaqAt(index: number) {
    const item = faqs[index];
    if (!item) return;
    if (item.isNew) {
      setFaqs((l) => l.filter((_, i) => i !== index));
      return;
    }
    const result = await removeProductFaq({ productId, faqId: item.id });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setFaqs(
      result.data.faqs.map((f) => ({
        id: f.id,
        question: f.question,
        answer: toPlainText(f.answer as never),
        scope: "product",
        published: true,
      })),
    );
    toast.success("FAQ deleted");
    router.refresh();
  }
  async function moveFaq(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= faqs.length) return;
    if (faqs[index]?.isNew || faqs[target]?.isNew) {
      toast.error("Save the new FAQ before reordering.");
      return;
    }
    const next = [...faqs];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    const result = await reorderProductFaqsList({ productId, faqIds: next.map((f) => f.id) });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setFaqs(next);
    router.refresh();
  }

  function addTestimonial() {
    setTestimonials((l) => [
      ...l,
      {
        id: `new-${Date.now()}`,
        quote: "",
        author: "",
        title: undefined,
        company: undefined,
        context: "product",
        published: false,
        isNew: true,
      },
    ]);
  }
  function updateTestimonial(id: string, patch: Partial<TestimonialItem>) {
    setTestimonials((l) => l.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  async function saveTestimonialAt(index: number) {
    const item = testimonials[index];
    if (!item) return;
    if (item.author.trim().length === 0 || item.quote.trim().length === 0) {
      toast.error("Author and quote are required.");
      return;
    }
    const result = await saveProductTestimonial({
      productId,
      id: item.isNew ? undefined : item.id,
      authorName: item.author.trim(),
      authorTitle: item.title?.trim() || undefined,
      company: item.company?.trim() || undefined,
      quote: item.quote.trim(),
      position: index,
      published: item.published,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    // `upsertProductTestimonial` returns the base `ProductTestimonialView[]` (no `published`,
    // that's only on `ProductAdminGraph.testimonials`), so the saved list can't be trusted for
    // publish state — keep this row's local fields, just adopt the server id / drop `isNew`.
    const saved = result.data.testimonials[index];
    setTestimonials((l) =>
      l.map((t, j) => (j === index ? { ...t, id: saved?.id ?? t.id, isNew: undefined } : t)),
    );
    toast.success("Testimonial saved");
    router.refresh();
  }
  async function deleteTestimonialAt(index: number) {
    const item = testimonials[index];
    if (!item) return;
    if (item.isNew) {
      setTestimonials((l) => l.filter((_, i) => i !== index));
      return;
    }
    const result = await removeProductTestimonial({ productId, id: item.id });
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    setTestimonials((l) => l.filter((_, i) => i !== index));
    toast.success("Testimonial deleted");
    router.refresh();
  }

  return (
    <div className="-mx-4 -mt-6 lg:-mx-6">
      <header className="sticky top-[calc(var(--admin-top)+3.5rem)] z-(--ck-z-sticky) flex flex-wrap items-center gap-3 border-b border-border bg-canvas px-4 py-3 lg:px-6">
        <Button asChild variant="ghost" size="sm">
          <Link href={listHref}>
            <ArrowLeftIcon aria-hidden /> Products
          </Link>
        </Button>
        <h1 className="text-h3">{isNew ? "New product" : product.name}</h1>
        {!isNew ? <StatusBadge kind="products.status" value={product.status} /> : null}
        {product.approval && product.approval.status === "pending" ? (
          <Link href={approvalsHref}>
            <StatusBadge kind="approval_requests.status" value="pending" size="sm" />
          </Link>
        ) : null}
        {!isNew ? (
          <span className="text-caption text-fg-muted" aria-live="polite">
            Saved {product.savedAgoSeconds} s ago
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" disabled title="Signed preview links aren't wired yet">
            <ExternalLinkIcon aria-hidden /> Preview
          </Button>
          {!isNew ? (
            <Button size="sm" onClick={() => setTab("publish")}>
              {product.status === "published" ? "Schedule update" : "Submit for approval"}
            </Button>
          ) : null}
          {!isNew ? (
            <RowActions
              label="More product actions"
              actions={[
                {
                  label: "Unpublish",
                  disabled: product.status !== "published",
                  onSelect: () => {
                    setLifecycleReason("");
                    setLifecycleDialog("unpublish");
                  },
                },
                {
                  label: "Request archive",
                  disabled: product.status === "archived",
                  onSelect: () => {
                    setLifecycleReason("");
                    setLifecycleDialog("archive");
                  },
                },
                {
                  label: "Request delete",
                  destructive: true,
                  disabled: product.orderCount > 0,
                  onSelect: () => {
                    setLifecycleReason("");
                    setLifecycleDialog("delete");
                  },
                },
                { label: "Duplicate as draft", separatorBefore: true, disabled: true },
              ]}
            />
          ) : null}
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
            <form onSubmit={saveBasics} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="p-name" label="Name" required>
                  <Input id="p-name" name="name" defaultValue={product.name} required aria-required />
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
                    name="slug"
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
                  name="shortDescription"
                  defaultValue={product.shortDescription}
                  maxLength={160}
                  rows={2}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="p-category" label="Category">
                  <Select name="categoryId" defaultValue={product.categoryId ?? "none"}>
                    <SelectTrigger id="p-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Uncategorized</SelectItem>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field id="p-tags" label="Tags" hint="Enter to add, click × to remove.">
                  <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2 py-1">
                    {tags.map((t) => (
                      <Badge key={t} tone="neutral" className="gap-1 pr-1">
                        {t}
                        <button
                          type="button"
                          aria-label={`Remove tag ${t}`}
                          onClick={() => setTags((l) => l.filter((x) => x !== t))}
                          className="grid size-4 place-items-center rounded-full hover:bg-danger-soft hover:text-danger"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                    <Input
                      id="p-tags"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTag();
                        }
                      }}
                      placeholder="Add tag"
                      className="h-7 w-32 border-0 px-1"
                    />
                  </div>
                </Field>
              </div>
              {!isNew ? (
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
              ) : null}
              <fieldset className="space-y-3" disabled={isNew}>
                <legend className="text-body-sm font-semibold">
                  Flags{isNew ? " (set after creating the product)" : ""}
                </legend>
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
              <Button type="submit" disabled={savingTab === "basics"}>
                {isNew ? "Create product" : "Save changes"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="content" className="space-y-5">
            <form onSubmit={saveContent} className="space-y-5">
              <RichTextField
                id="p-desc"
                name="description"
                label="Rich description"
                required
                defaultValue={product.description}
                rows={6}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <ListEditor id="p-list-Features" label="Features" items={features} onChange={setFeatures} />
                <ListEditor id="p-list-Benefits" label="Benefits" items={benefits} onChange={setBenefits} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id="p-industry"
                  label="Industry"
                  optional
                  hint="Not wired yet — the editor's data shape has no industry field."
                >
                  <Input id="p-industry" placeholder="Add industries" disabled />
                </Field>
                <Field id="p-tech" label="Tech stack" hint="Enter to add, click × to remove.">
                  <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2 py-1">
                    {techStack.map((t) => (
                      <Badge key={t} tone="accent" className="gap-1 pr-1">
                        {t}
                        <button
                          type="button"
                          aria-label={`Remove ${t}`}
                          onClick={() => setTechStack((l) => l.filter((x) => x !== t))}
                          className="grid size-4 place-items-center rounded-full hover:bg-danger-soft"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                    <Input
                      id="p-tech"
                      value={newTech}
                      onChange={(e) => setNewTech(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTech();
                        }
                      }}
                      placeholder="Add"
                      className="h-7 w-24 border-0 px-1"
                    />
                  </div>
                </Field>
              </div>
              <Field
                id="p-req"
                label="Requirements"
                optional
                hint="Not wired yet — the editor's data shape has no requirements field."
              >
                <Textarea id="p-req" rows={3} disabled />
              </Field>
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
                <Input id="p-demo" name="liveDemoUrl" type="url" defaultValue={product.liveDemoUrl} />
              </Field>
              {flags.has("is_unlisted") ? (
                <Banner tone="warning">
                  A live-demo URL of an unlisted product is public once known.
                </Banner>
              ) : null}
              <Button type="submit" disabled={savingTab === "content"}>
                Save content
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="media" className="space-y-5">
            <input
              ref={mediaFileInputRef}
              type="file"
              className="sr-only"
              accept="image/*,video/mp4,video/webm,application/pdf"
              onChange={onMediaFileChosen}
            />
            <div className="rounded-lg border-2 border-dashed border-border-strong p-8 text-center">
              <UploadIcon aria-hidden className="mx-auto size-8 text-fg-subtle" />
              <p className="mt-2 text-body">
                Images, video (≤ 200 MB) or a presentation PDF. Alt text is required for images.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => mediaFileInputRef.current?.click()}
              >
                Choose file
              </Button>
            </div>
            {pendingMediaFile ? (
              <div className="flex flex-wrap items-end gap-3 rounded-md border border-border bg-surface p-3">
                <span className="font-mono text-body-sm">{pendingMediaFile.name}</span>
                {mediaKindFor(pendingMediaFile.type) === "image" ? (
                  <Field id="pending-alt" label="Alt text" className="min-w-48 flex-1">
                    <Input
                      id="pending-alt"
                      value={pendingMediaAlt}
                      onChange={(e) => setPendingMediaAlt(e.target.value)}
                      required
                    />
                  </Field>
                ) : null}
                <Button size="sm" onClick={confirmMediaUpload} loading={uploadingMedia}>
                  Upload &amp; attach
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPendingMediaFile(null)}
                  disabled={uploadingMedia}
                >
                  Cancel
                </Button>
              </div>
            ) : null}
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
              {product.media.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface p-3"
                >
                  <span
                    aria-hidden
                    className="grid size-12 place-items-center rounded-sm bg-elevated text-caption text-fg-subtle"
                  >
                    {m.kind === "video_embed" ? "▶" : m.kind === "presentation" ? "PDF" : "IMG"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-body-sm">{m.fileName}</span>
                    <span className="block text-caption text-fg-muted">{m.kind}</span>
                  </span>
                  {m.alt ? (
                    <span className="w-64 truncate text-caption text-fg-muted">Alt: {m.alt}</span>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeMedia(m.id)}
                    loading={removingMediaId === m.id}
                  >
                    Remove
                  </Button>
                </li>
              ))}
              {product.media.length === 0 ? (
                <li className="text-body-sm text-fg-muted">No media yet.</li>
              ) : null}
            </ul>
          </TabsContent>

          <TabsContent value="offerings" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-body-sm text-fg-muted">
                “Offering”, never “plan” or “tier”. Prices are stored in minor units per enabled
                currency. New offerings default to manual UPI/bank payment and manual
                provisioning — edit delivery config and extra currencies later.
              </p>
              <Button size="sm" onClick={() => setAddOfferingOpen(true)}>
                <PlusIcon aria-hidden /> Add offering
              </Button>
            </div>
            <Dialog open={addOfferingOpen} onOpenChange={setAddOfferingOpen}>
              <DialogContent>
                <form onSubmit={handleAddOffering}>
                  <DialogHeader>
                    <DialogTitle>Add offering</DialogTitle>
                    <DialogDescription>
                      Base price is in INR. You can add more currencies and refine delivery
                      config after creating it.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <Field id="off-name" label="Name">
                      <Input id="off-name" name="offeringName" required maxLength={120} />
                    </Field>
                    <Field id="off-price" label="Price (INR)">
                      <Input
                        id="off-price"
                        name="offeringPrice"
                        type="number"
                        min="1"
                        step="0.01"
                        required
                      />
                    </Field>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field id="off-model" label="Purchase model">
                        <Select
                          value={offeringPurchaseModel}
                          onValueChange={(v) =>
                            setOfferingPurchaseModel(v as (typeof PURCHASE_MODELS)[number])
                          }
                        >
                          <SelectTrigger id="off-model">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PURCHASE_MODELS.map((m) => (
                              <SelectItem key={m} value={m}>
                                {PURCHASE_MODEL_LABEL[m]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field id="off-delivery" label="Delivery type">
                        <Select
                          value={offeringDeliveryType}
                          onValueChange={(v) =>
                            setOfferingDeliveryType(v as (typeof DELIVERY_TYPES)[number])
                          }
                        >
                          <SelectTrigger id="off-delivery">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {DELIVERY_TYPES.map((d) => (
                              <SelectItem key={d} value={d}>
                                {DELIVERY_TYPE_LABEL[d]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    </div>
                    {offeringPurchaseModel === "subscription" ? (
                      <Field id="off-interval" label="Billing interval">
                        <Select
                          value={offeringBillingInterval}
                          onValueChange={(v) =>
                            setOfferingBillingInterval(v as (typeof BILLING_INTERVALS)[number])
                          }
                        >
                          <SelectTrigger id="off-interval">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BILLING_INTERVALS.map((b) => (
                              <SelectItem key={b} value={b}>
                                {b}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    ) : null}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="ghost">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button type="submit" loading={savingOffering}>
                      Create offering
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
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
            <Banner tone="neutral">
              Delivery config isn't wired in this pass — shown read-only per offering.
            </Banner>
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
                    <Field id={`dl-type-${o.id}`} label="Delivery type">
                      <Input id={`dl-type-${o.id}`} readOnly value={o.deliveryType} />
                    </Field>
                    <Field id={`dl-model-${o.id}`} label="Purchase model">
                      <Input id={`dl-model-${o.id}`} readOnly value={o.purchaseModel} />
                    </Field>
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
            {product.partners.length === 0 ? (
              <p className="text-caption text-fg-muted">
                No partners to propose a split with — this admin account can't list partners
                (needs finance or user-management access), or none exist yet.
              </p>
            ) : null}
            {proposing ? (
              <ProposeSplitForm
                split={split}
                onChange={setSplit}
                partners={product.partners}
                approvers={approvers}
                onCancel={() => setProposing(false)}
                onSubmit={submitOwnershipProposal}
              />
            ) : (
              <Button
                variant="secondary"
                onClick={() => setProposing(true)}
                disabled={Boolean(pendingOwnership) || product.partners.length === 0}
              >
                Propose new split
              </Button>
            )}
          </TabsContent>

          <TabsContent value="seo" className="space-y-5">
            <form onSubmit={saveSeo} className="space-y-5">
              <Field id="seo-title" label="SEO title" hint={`${product.seo.title.length}/60`}>
                <Input id="seo-title" name="seoTitle" defaultValue={product.seo.title} maxLength={60} />
              </Field>
              <Field
                id="seo-desc"
                label="Meta description"
                hint={`${product.seo.description.length}/160`}
              >
                <Textarea
                  id="seo-desc"
                  name="seoDescription"
                  defaultValue={product.seo.description}
                  maxLength={160}
                  rows={2}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="seo-canonical" label="Canonical URL" optional>
                  <Input id="seo-canonical" name="canonicalUrl" type="url" defaultValue={product.seo.canonical} />
                </Field>
                <Field id="seo-og" label="OG image override" optional>
                  <Select name="ogImageMediaId" defaultValue="none">
                    <SelectTrigger id="seo-og">
                      <SelectValue placeholder="Use cover image" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Use cover image</SelectItem>
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
                <pre className="overflow-auto rounded-md bg-canvas p-3 font-mono text-caption text-fg-muted">{`{ "@type": "Product", "name": "${product.name}" }`}</pre>
              </div>
              <Button type="submit" disabled={savingTab === "seo"}>
                Save SEO
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="blog" className="space-y-5">
            <Banner tone="neutral">
              The blog body and its own SEO fields aren't wired in this pass — the editor's data
              shape only carries title/slug/excerpt/status, while <code>upsertProductBlog</code>
              also needs a body and accepts optional SEO overrides. Showing current values
              read-only.
            </Banner>
            <div className="flex items-center gap-2">
              <StatusBadge kind="product_blogs.status" value={product.blog.status} />
              <Button size="sm" variant="secondary" disabled title="Not wired in this pass">
                {product.blog.status === "published" ? "Unpublish blog" : "Publish blog"}
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="blog-title" label="Title">
                <Input id="blog-title" readOnly value={product.blog.title} />
              </Field>
              <Field id="blog-slug" label="Slug">
                <Input id="blog-slug" readOnly value={product.blog.slug} className="font-mono" />
              </Field>
            </div>
            <Field id="blog-excerpt" label="Excerpt">
              <Textarea id="blog-excerpt" readOnly value={product.blog.excerpt} rows={2} />
            </Field>
          </TabsContent>

          <TabsContent value="versions" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-body-sm text-fg-muted">
                Adding a version sets `current_version` and notifies owners per update policy.
              </p>
              <Button size="sm" disabled title="Not wired in this pass — needs a changelog form">
                <PlusIcon aria-hidden /> Add version
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-surface">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Released</TableHead>
                    <TableHead>Changelog</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.versions.map((v) => (
                    <TableRow key={v.version}>
                      <TableCell className="font-mono">{v.version}</TableCell>
                      <TableCell>{formatDate(v.releasedAt)}</TableCell>
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
                Curated by admins — there are no public reviews (D-312). Reordering isn't wired
                in this pass (no reorder action for testimonials).
              </p>
              <Button size="sm" onClick={addTestimonial}>
                <PlusIcon aria-hidden /> Add testimonial
              </Button>
            </div>
            <ul className="space-y-3">
              {testimonials.map((t, i) => (
                <li
                  key={t.id}
                  className="space-y-2 rounded-md border border-border bg-surface p-3"
                >
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Field id={`tm-author-${t.id}`} label="Author" required>
                      <Input
                        id={`tm-author-${t.id}`}
                        value={t.author}
                        onChange={(e) => updateTestimonial(t.id, { author: e.target.value })}
                      />
                    </Field>
                    <Field id={`tm-title-${t.id}`} label="Title" optional>
                      <Input
                        id={`tm-title-${t.id}`}
                        value={t.title ?? ""}
                        onChange={(e) => updateTestimonial(t.id, { title: e.target.value })}
                      />
                    </Field>
                    <Field id={`tm-company-${t.id}`} label="Company" optional>
                      <Input
                        id={`tm-company-${t.id}`}
                        value={t.company ?? ""}
                        onChange={(e) => updateTestimonial(t.id, { company: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Field id={`tm-quote-${t.id}`} label="Quote" required>
                    <Textarea
                      id={`tm-quote-${t.id}`}
                      value={t.quote}
                      onChange={(e) => updateTestimonial(t.id, { quote: e.target.value })}
                      rows={2}
                    />
                  </Field>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`tm-pub-${t.id}`}
                        checked={t.published}
                        onCheckedChange={(v) => updateTestimonial(t.id, { published: v })}
                        aria-label={`Published: ${t.author || "new testimonial"}`}
                      />
                      <Label htmlFor={`tm-pub-${t.id}`}>Published</Label>
                    </div>
                    <Button size="sm" onClick={() => saveTestimonialAt(i)}>
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() => deleteTestimonialAt(i)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
              {testimonials.length === 0 ? (
                <li className="text-body-sm text-fg-muted">No testimonials yet.</li>
              ) : null}
            </ul>
          </TabsContent>

          <TabsContent value="faqs" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-body-sm text-fg-muted">
                Product FAQs feed the assistant&rsquo;s knowledge index.
              </p>
              <Button size="sm" onClick={addFaq}>
                <PlusIcon aria-hidden /> Add FAQ
              </Button>
            </div>
            <ul className="space-y-3">
              {faqs.map((f, i) => (
                <li key={f.id} className="space-y-2 rounded-md border border-border bg-surface p-3">
                  <Field id={`faq-q-${f.id}`} label={`Question ${i + 1}`} required>
                    <Input
                      id={`faq-q-${f.id}`}
                      value={f.question}
                      onChange={(e) => updateFaq(f.id, { question: e.target.value })}
                    />
                  </Field>
                  <Field id={`faq-a-${f.id}`} label="Answer" required>
                    <Textarea
                      id={`faq-a-${f.id}`}
                      value={f.answer}
                      onChange={(e) => updateFaq(f.id, { answer: e.target.value })}
                      rows={2}
                    />
                  </Field>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" disabled={i === 0} onClick={() => moveFaq(i, -1)}>
                      Move up
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={i === faqs.length - 1}
                      onClick={() => moveFaq(i, 1)}
                    >
                      Move down
                    </Button>
                    <Button size="sm" onClick={() => saveFaqAt(i)}>
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      onClick={() => deleteFaqAt(i)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
              {faqs.length === 0 ? <li className="text-body-sm text-fg-muted">No FAQs yet.</li> : null}
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
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const publishAt = String(new FormData(e.currentTarget).get("publishAt") ?? "");
                void submitForApproval(publishAt);
              }}
            >
              <Field id="pub-at" label="Publish at" optional hint="Leave empty to publish on approval (D-307).">
                <Input id="pub-at" name="publishAt" type="datetime-local" />
              </Field>
              <ApprovalGateNotice approvers={approvers} what="Publishing" />
              <div className="flex gap-2">
                <Button type="submit" disabled={product.status === "published" || product.status === "pending_approval" || product.status === "archived"}>
                  Submit for approval
                </Button>
                {product.status === "published" ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setLifecycleReason("");
                      setLifecycleDialog("unpublish");
                    }}
                  >
                    Unpublish
                  </Button>
                ) : null}
              </div>
            </form>
            {product.approval ? (
              <div className="rounded-lg border border-border bg-surface p-4">
                <h2 className="mb-2 text-h4">Approval history</h2>
                <p className="flex items-center gap-2 text-body-sm">
                  <StatusBadge
                    kind="approval_requests.status"
                    value={product.approval.status}
                    size="sm"
                  />{" "}
                  {formatDateTime(product.approval.at)}
                </p>
              </div>
            ) : null}
          </TabsContent>
        </div>
      </Tabs>

      <Dialog open={lifecycleDialog !== null} onOpenChange={(o) => !o && setLifecycleDialog(null)}>
        <DialogContent>
          {lifecycleDialog ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {lifecycleDialog === "unpublish"
                    ? `Unpublish ${product.name}?`
                    : lifecycleDialog === "archive"
                      ? `Archive ${product.name}?`
                      : `Delete ${product.name}?`}
                </DialogTitle>
                <DialogDescription>
                  {lifecycleDialog === "unpublish"
                    ? "The product page stops serving immediately. Existing customers keep access."
                    : lifecycleDialog === "archive"
                      ? "Existing customers keep access. Another admin must approve."
                      : "Another admin must approve. Blocked while any orders exist."}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-1.5">
                <Label htmlFor="pe-lifecycle-reason" required>
                  Reason
                </Label>
                <Textarea
                  id="pe-lifecycle-reason"
                  required
                  aria-required
                  value={lifecycleReason}
                  onChange={(e) => setLifecycleReason(e.target.value)}
                />
              </div>
              {lifecycleDialog !== "unpublish" ? (
                <ApprovalGateNotice
                  approvers={approvers}
                  what={lifecycleDialog === "archive" ? "Archiving" : "Deleting"}
                />
              ) : null}
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="ghost">Cancel</Button>
                </DialogClose>
                <Button
                  variant={lifecycleDialog === "delete" ? "destructive" : "primary"}
                  disabled={lifecycleBusy}
                  onClick={confirmLifecycle}
                >
                  {lifecycleDialog === "unpublish" ? "Unpublish" : "Request approval"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Repeatable short-line list with keyboard reorder buttons — controlled by the parent. */
function ListEditor({
  id,
  label,
  items,
  onChange,
}: {
  id: string;
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = React.useState("");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`${id}-new`}>{label}</Label>
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={`${id}-${i}`} className="flex items-center gap-1">
            <Input
              aria-label={`${label} ${i + 1}`}
              value={item}
              onChange={(e) =>
                onChange(items.map((v, j) => (j === i ? e.target.value : v)))
              }
              className="h-8"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${label} ${i + 1}`}
              onClick={() => onChange(items.filter((_, j) => j !== i))}
            >
              ×
            </Button>
          </li>
        ))}
      </ul>
      <div className="flex gap-1">
        <Input
          id={`${id}-new`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Add ${label.toLowerCase()}`}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const v = draft.trim();
              if (v) {
                onChange([...items, v]);
                setDraft("");
              }
            }
          }}
        />
      </div>
    </div>
  );
}

/** "Propose new split" form (ownership tab) — its own component so the effective-date input
 *  stays local state without adding another field to the parent's already-large state set. */
function ProposeSplitForm({
  split,
  onChange,
  partners,
  approvers,
  onCancel,
  onSubmit,
}: {
  split: SplitValue;
  onChange: (next: SplitValue) => void;
  partners: Array<{ id: string; name: string }>;
  approvers: string[];
  onCancel: () => void;
  onSubmit: (effectiveFrom: string) => void | Promise<void>;
}) {
  const [effectiveFrom, setEffectiveFrom] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const total = split.companyCutBps + split.lines.reduce((s, l) => s + l.bps, 0);

  return (
    <form
      className="space-y-4 rounded-lg border border-accent bg-surface p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        await onSubmit(effectiveFrom);
        setSubmitting(false);
      }}
    >
      <h2 className="text-h4">Propose new split</h2>
      <SplitEditor idPrefix="own" value={split} onChange={onChange} partners={partners} />
      <Field id="own-effective" label="Effective date" optional hint="Leave empty for as soon as approved.">
        <Input
          id="own-effective"
          type="date"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
        />
      </Field>
      <ApprovalGateNotice approvers={approvers} what="Changing ownership" />
      <div className="flex gap-2">
        <Button type="submit" disabled={total !== 10000 || submitting}>
          Request approval
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
