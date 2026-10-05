/**
 * View-model mappers: catalog module domain shapes (`modules/catalog/types`,
 * `modules/ownership/types`) -> admin component prop shapes (`components/admin/types`).
 * Kept out of the page components per the phase convention (mapping never lives in a
 * component) and out of the components themselves (they stay props-driven).
 *
 * Known gaps vs. a fully-populated editor -- the admin catalog service does not (yet) return
 * these, so the mapped fields are best-effort placeholders; see the phase report:
 *  - `listProductsAdmin` rows carry only `isFeatured` / `isUnlisted` (not `isComingSoon`,
 *    `isRefundable`, `taxEnabled`), no `currentVersion` and no price -- the list's flag set,
 *    version column and from-price are therefore partial/placeholder.
 *  - There is no `listTags` query (only per-product tags via `getProductAdmin`, and `upsertTag`
 *    to create one), so the categories/tags side panel has no tag list to show.
 *  - `ProductMediaView` has no byte size and `ProductVersionView` has no file count, so
 *    `MediaItem.sizeKb` / `ProductVersionRow.files` are 0.
 *  - Per-product storage usage isn't tracked (only a global total via `media.getStorageUsage`),
 *    so `storageUsedMb` is 0 against a fixed `storageCapMb`.
 *  - `ProductAdminGraph.approval` carries no approver identity or decision timestamp, so those
 *    are filled with a placeholder label / the product's own `updatedAt`.
 */
import type { StatusValue } from "@/lib/status-tone";
import type { RichTextDoc } from "@/modules/_shared/zod";
import { toPlainText } from "@/modules/content/render";
import type {
  CategoryNode as CatalogCategoryNode,
  ProductAdminGraph,
  ProductAdminRow,
} from "@/modules/catalog/types";
import type { OwnershipVersionView } from "@/modules/ownership/types";
import type {
  CategoryNode,
  FaqItem,
  MediaItem,
  OfferingRow,
  OwnershipVersion,
  ProductEditorData,
  ProductFlag,
  ProductRow,
  ProductVersionRow,
  TestimonialItem,
} from "@/components/admin/types";

export function mapCategoryNode(c: CatalogCategoryNode): CategoryNode {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    productCount: c.productCount,
    children: c.children.length > 0 ? c.children.map(mapCategoryNode) : undefined,
  };
}

/** Flattens the category tree into `id -> display name` ("Parent > Child" past depth 1). */
export function flattenCategoryNames(
  nodes: readonly CatalogCategoryNode[],
  prefix = "",
): Map<string, string> {
  const out = new Map<string, string>();
  for (const n of nodes) {
    const label = prefix ? `${prefix} > ${n.name}` : n.name;
    out.set(n.id, label);
    for (const [id, name] of flattenCategoryNames(n.children, label)) out.set(id, name);
  }
  return out;
}

export function mapProductRow(row: ProductAdminRow): ProductRow {
  const flags: ProductFlag[] = [];
  if (row.isFeatured) flags.push("is_featured");
  if (row.isUnlisted) flags.push("is_unlisted");

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category?.name ?? "Uncategorized",
    status: row.status,
    flags,
    offerings: row.offeringCount,
    fromPrice: undefined,
    version: "\u2014",
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy.name,
    awaitingApprovalId: row.status === "pending_approval" ? row.id : undefined,
    orderCount: row.orderCount,
  };
}

function asRichText(doc: unknown): RichTextDoc | null {
  return (doc as RichTextDoc | null) ?? null;
}

function mapOwnershipVersion(v: OwnershipVersionView): OwnershipVersion {
  return {
    version: v.version,
    companyCutBps: v.companyCutBps,
    lines: v.lines.map((l) => ({
      partnerId: l.partnerId,
      partnerName: l.displayName,
      bps: l.shareBps,
    })),
    effectiveFrom: v.effectiveFrom ?? v.createdAt,
    status: v.status,
    approvalId: v.approvalRequestId ?? undefined,
  };
}

const STORAGE_CAP_MB_DEFAULT = 500;

export function mapProductGraphToEditorData(
  graph: ProductAdminGraph,
  opts: { categoryName: string; partners: Array<{ id: string; name: string }> },
): ProductEditorData {
  const { product } = graph;

  const flags: ProductFlag[] = [];
  if (product.isFeatured) flags.push("is_featured");
  if (product.isUnlisted) flags.push("is_unlisted");
  if (product.isComingSoon) flags.push("is_coming_soon");
  if (product.isRefundable) flags.push("is_refundable");
  if (product.taxEnabled) flags.push("tax_enabled");

  const media: MediaItem[] = graph.media.map((m) => ({
    id: m.id,
    kind: m.kind,
    fileName: m.title ?? m.url.split("/").pop() ?? m.id,
    alt: m.alt,
    sizeKb: 0,
  }));

  const offerings: OfferingRow[] = graph.offerings.map((o) => ({
    id: o.id,
    slug: o.slug,
    position: o.position,
    name: o.name,
    purchaseModel: o.purchaseModel,
    billingInterval: o.billingInterval ?? undefined,
    trialDays: o.trialDays ?? undefined,
    licenseType: o.licenseType ?? undefined,
    deliveryType: o.deliveryType,
    deliveryConfig: {
      provisioning: o.deliveryConfig.provisioning ?? "manual",
      downloadCap: o.deliveryConfig.downloadCap,
      accessMonths: o.deliveryConfig.accessMonths,
      updatePolicy: o.deliveryConfig.updatePolicy ?? "all_free",
      instructionsText: toPlainText(asRichText(o.deliveryConfig.instructionsJson ?? null)),
      repoUrl: o.deliveryConfig.repoUrl,
      appUrl: o.deliveryConfig.appUrl,
      customerHosted: o.deliveryConfig.customerHosted,
    },
    serviceSteps: o.serviceSteps ?? undefined,
    basePrice: o.price?.base ?? { amountMinor: 0, currency: "INR" },
    compareAt: o.price?.compareAt ?? undefined,
    prices: o.prices.map((p) => ({
      currency: p.currency,
      amountMinor: p.amountMinor,
      compareAtMinor: p.compareAtMinor ?? undefined,
    })),
    methods: o.paymentMethods
      .map((m) => (m === "manual_upi" ? "upi" : m === "manual_bank" ? "bank" : null))
      .filter((m): m is "upi" | "bank" => m !== null),
    paymentMethodValues: o.paymentMethods,
    status: o.status,
    isDefault: o.isDefault,
  }));

  const versions: ProductVersionRow[] = graph.versions.map((v) => ({
    version: v.version,
    releasedAt: v.releasedAt,
    files: 0,
    changelog: v.changelog?.summary ?? "",
  }));

  const testimonials: TestimonialItem[] = graph.testimonials.map((t) => ({
    id: t.id,
    quote: t.quote,
    author: t.authorName,
    title: t.authorTitle ?? undefined,
    company: t.company ?? undefined,
    context: "product",
    published: t.published,
  }));

  const faqs: FaqItem[] = graph.faqs.map((f) => ({
    id: f.id,
    question: f.question,
    answer: toPlainText(asRichText(f.answer)),
    scope: "product",
    published: true,
  }));

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    shortDescription: product.shortDescription,
    category: opts.categoryName,
    categoryId: product.categoryId ?? undefined,
    tags: graph.tags.map((t) => t.name),
    status: product.status,
    flags,
    currentVersion: product.currentVersion ?? "",
    description: toPlainText(asRichText(product.descriptionJson)),
    features: (product.features ?? []).map((b) => b.title),
    benefits: (product.benefits ?? []).map((b) => b.title),
    techStack: product.techStack,
    liveDemoUrl: product.liveDemoUrl ?? undefined,
    media,
    storageUsedMb: 0,
    storageCapMb: STORAGE_CAP_MB_DEFAULT,
    offerings,
    ownership: graph.ownershipVersions.map(mapOwnershipVersion),
    partners: opts.partners,
    seo: {
      title: product.seoTitle ?? "",
      description: product.seoDescription ?? "",
      canonical: product.canonicalUrl ?? undefined,
    },
    blog: {
      title: graph.blog?.title ?? "",
      slug: graph.blog?.slug ?? "",
      excerpt: graph.blog?.excerpt ?? "",
      status: graph.blog?.status ?? "draft",
    },
    versions,
    testimonials,
    faqs,
    approval: graph.approval
      ? {
          status: graph.approval.status as StatusValue<"approval_requests.status">,
          approver: "Pending decision",
          at: product.updatedAt.toISOString(),
        }
      : undefined,
    savedAgoSeconds: Math.max(0, Math.round((Date.now() - product.updatedAt.getTime()) / 1000)),
    updatedAt: product.updatedAt.toISOString(),
    orderCount: graph.orderCount,
  };
}
