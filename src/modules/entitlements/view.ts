/**
 * Entitlement read model — API-DEL-01 `EntitlementView` and API-DEL-06 `EntitlementAdminRow`
 * (PHASE-05 P5.1/P5.9). One batched loader (`loadEntitlementBundles`) gathers everything a
 * handler or a view needs; the builders are pure over the bundle.
 */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { TxCtx } from "@/lib/db";
import type { User } from "../../../drizzle/schema/auth";
import { type Product, productVersions, products } from "../../../drizzle/schema/catalog";
import { orderItems, orders } from "../../../drizzle/schema/commerce";
import {
  type DeliveryTask,
  type Entitlement,
  type ServiceProgress,
  type Subscription,
  deliveryTasks,
  entitlements,
  releaseFiles,
  serviceProgress,
  subscriptions,
} from "../../../drizzle/schema/delivery";
import { invoices } from "../../../drizzle/schema/invoices";
import { media } from "../../../drizzle/schema/media";
import { type Offering, offerings } from "../../../drizzle/schema/offerings";
import { users } from "../../../drizzle/schema/auth";
import type { TiptapDoc } from "../../../drizzle/schema/catalog";
import type {
  CustomerDeliveryView,
  DeliveryHandlerContext,
  DeliveryHandlerRegistry,
} from "@/modules/delivery/handler";
import { addDays } from "@/lib/dates";
import type { EntitlementAdminAction, EntitlementAdminRow, EntitlementView } from "./types";

export interface ReleaseFileRow {
  mediaId: string;
  version: string;
  name: string;
  sizeBytes: number;
  releasedAt: Date;
  notes: string | null;
  bucket: string;
  objectKey: string;
  mime: string;
}

export interface EntitlementBundle {
  entitlement: Entitlement;
  offering: Offering;
  product: Product;
  customer: Pick<User, "id" | "email" | "name">;
  subscription: Subscription | null;
  serviceProgress: ServiceProgress[];
  releaseFiles: ReleaseFileRow[];
  openTasks: DeliveryTask[];
  order: { id: string; orderNo: string } | null;
  invoiceNo: string | null;
  versions: Array<{ version: string; releasedAt: Date; changelog: string | null }>;
}

function fileName(objectKey: string): string {
  const last = objectKey.split("/").pop();
  return last === undefined || last === "" ? objectKey : last;
}

/** Load bundles for already-selected entitlement rows (batched, order preserved). */
export async function loadEntitlementBundles(
  tx: TxCtx,
  rows: readonly Entitlement[],
): Promise<EntitlementBundle[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const offeringIds = Array.from(new Set(rows.map((r) => r.offeringId)));
  const productIds = Array.from(new Set(rows.map((r) => r.productId)));
  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const orderItemIds = rows.flatMap((r) => (r.orderItemId === null ? [] : [r.orderItemId]));

  const [offeringRows, productRows, userRows, subRows, progressRows, taskRows, fileRows, versionRows] =
    await Promise.all([
      tx.select().from(offerings).where(inArray(offerings.id, offeringIds)),
      tx.select().from(products).where(inArray(products.id, productIds)),
      tx
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(inArray(users.id, userIds)),
      tx.select().from(subscriptions).where(inArray(subscriptions.entitlementId, ids)),
      tx
        .select()
        .from(serviceProgress)
        .where(inArray(serviceProgress.entitlementId, ids))
        .orderBy(asc(serviceProgress.createdAt)),
      tx
        .select()
        .from(deliveryTasks)
        .where(and(inArray(deliveryTasks.entitlementId, ids), eq(deliveryTasks.status, "open")))
        .orderBy(asc(deliveryTasks.createdAt)),
      tx
        .select({
          productId: releaseFiles.productId,
          mediaId: releaseFiles.mediaId,
          version: releaseFiles.version,
          notes: releaseFiles.notes,
          releasedAt: releaseFiles.releasedAt,
          sizeBytes: media.sizeBytes,
          bucket: media.bucket,
          objectKey: media.objectKey,
          mime: media.mime,
        })
        .from(releaseFiles)
        .innerJoin(media, eq(media.id, releaseFiles.mediaId))
        .where(inArray(releaseFiles.productId, productIds))
        .orderBy(desc(releaseFiles.releasedAt)),
      tx
        .select({
          productId: productVersions.productId,
          version: productVersions.version,
          releasedAt: productVersions.releasedAt,
          changelogJson: productVersions.changelogJson,
        })
        .from(productVersions)
        .where(inArray(productVersions.productId, productIds))
        .orderBy(desc(productVersions.releasedAt)),
    ]);

  const orderRows =
    orderItemIds.length === 0
      ? []
      : await tx
          .select({
            orderItemId: orderItems.id,
            orderId: orders.id,
            orderNo: orders.orderNo,
            invoiceNo: invoices.invoiceNo,
          })
          .from(orderItems)
          .innerJoin(orders, eq(orders.id, orderItems.orderId))
          .leftJoin(invoices, eq(invoices.orderId, orders.id))
          .where(inArray(orderItems.id, orderItemIds));

  const offeringById = new Map(offeringRows.map((o) => [o.id, o]));
  const productById = new Map(productRows.map((p) => [p.id, p]));
  const userById = new Map(userRows.map((u) => [u.id, u]));
  const subByEnt = new Map(subRows.map((s) => [s.entitlementId, s]));
  const orderByItem = new Map(orderRows.map((o) => [o.orderItemId, o]));

  return rows.map((entitlement) => {
    const offering = offeringById.get(entitlement.offeringId);
    const product = productById.get(entitlement.productId);
    const customer = userById.get(entitlement.userId);
    if (offering === undefined || product === undefined || customer === undefined) {
      throw new Error(`entitlement ${entitlement.id}: offering/product/user row missing`);
    }
    const orderRow = entitlement.orderItemId === null ? undefined : orderByItem.get(entitlement.orderItemId);
    return {
      entitlement,
      offering,
      product,
      customer,
      subscription: subByEnt.get(entitlement.id) ?? null,
      serviceProgress: progressRows.filter((p) => p.entitlementId === entitlement.id),
      releaseFiles: fileRows
        .filter((f) => f.productId === entitlement.productId)
        .map((f) => ({
          mediaId: f.mediaId,
          version: f.version,
          name: fileName(f.objectKey),
          sizeBytes: f.sizeBytes,
          releasedAt: f.releasedAt,
          notes: f.notes,
          bucket: f.bucket,
          objectKey: f.objectKey,
          mime: f.mime,
        })),
      openTasks: taskRows.filter((t) => t.entitlementId === entitlement.id),
      order: orderRow === undefined ? null : { id: orderRow.orderId, orderNo: orderRow.orderNo },
      invoiceNo: orderRow?.invoiceNo ?? null,
      versions: versionRows
        .filter((v) => v.productId === entitlement.productId)
        .map((v) => ({
          version: v.version,
          releasedAt: v.releasedAt,
          changelog: v.changelogJson?.summary ?? null,
        })),
    };
  });
}

export async function loadEntitlementBundle(
  tx: TxCtx,
  entitlementId: string,
): Promise<EntitlementBundle | null> {
  const [row] = await tx.select().from(entitlements).where(eq(entitlements.id, entitlementId)).limit(1);
  if (row === undefined) return null;
  const [bundle] = await loadEntitlementBundles(tx, [row]);
  return bundle ?? null;
}

export function handlerContext(
  bundle: EntitlementBundle,
  input: { actorId: string | null; requestId: string; manualGrant: boolean },
): DeliveryHandlerContext {
  return {
    actorId: input.actorId,
    requestId: input.requestId,
    offering: {
      id: bundle.offering.id,
      name: bundle.offering.name,
      deliveryConfig: bundle.offering.deliveryConfig,
      serviceSteps: bundle.offering.serviceSteps,
      purchaseModel: bundle.offering.purchaseModel,
    },
    product: { id: bundle.product.id, name: bundle.product.name, slug: bundle.product.slug },
    customer: { id: bundle.customer.id, email: bundle.customer.email, name: bundle.customer.name },
    subscription: bundle.subscription,
    manualGrant: bundle.entitlement.orderItemId === null,
  };
}

/** "Renew now" from 14 days before `periodEnd` through grace (SCR-ACC-03). */
export const RENEW_WINDOW_DAYS = 14;

export function subscriptionView(
  sub: Subscription,
  renewalOrderNo: string | null,
  now: Date,
): NonNullable<EntitlementView["subscription"]> {
  const windowStart = addDays(sub.currentPeriodEnd, -RENEW_WINDOW_DAYS);
  const graceEnd = sub.graceUntil ?? sub.currentPeriodEnd;
  const canRenew =
    sub.status !== "cancelled" &&
    !sub.cancelAtPeriodEnd &&
    now.getTime() >= windowStart.getTime() &&
    (sub.status === "suspended" || now.getTime() <= graceEnd.getTime());
  return {
    subscriptionId: sub.id,
    interval: sub.interval,
    status: sub.status,
    periodStart: sub.currentPeriodStart.toISOString(),
    periodEnd: sub.currentPeriodEnd.toISOString(),
    graceUntil: sub.graceUntil?.toISOString() ?? null,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    renewalOrderNo,
    canRenew,
  };
}

export interface ViewOptions {
  registry: DeliveryHandlerRegistry;
  renderRichText: (doc: TiptapDoc | null | undefined) => string | null;
  now: Date;
  requestId: string;
  /** `orders.order_no` of `subscriptions.renewal_order_id`, when loaded. */
  renewalOrderNo?: string | null;
}

function deliverySlice(view: CustomerDeliveryView): Partial<EntitlementView> {
  switch (view.type) {
    case "download":
      return { downloads: view.downloads };
    case "license":
      return { licenseKeyMasked: view.licenseKeyMasked };
    case "saas":
    case "hosted":
      return { provisioning: view.provisioning };
    case "service":
      return { serviceProgress: view.serviceProgress };
    case "custom":
      return { custom: view.custom };
  }
}

/** API-DEL-01 view: common fields + the handler's per-type slice. */
export function toEntitlementView(bundle: EntitlementBundle, opts: ViewOptions): EntitlementView {
  const { entitlement } = bundle;
  const handler = opts.registry.get(entitlement.deliveryType);
  const ctx = handlerContext(bundle, { actorId: null, requestId: opts.requestId, manualGrant: false });
  const slice = handler.customerView({
    entitlement,
    ctx,
    serviceProgress: bundle.serviceProgress,
    releaseFiles: bundle.releaseFiles,
    openTasks: bundle.openTasks,
  });
  const view: EntitlementView = {
    entitlementId: entitlement.id,
    product: {
      id: bundle.product.id,
      name: bundle.product.name,
      slug: bundle.product.slug,
      published: bundle.product.status === "published",
    },
    offering: { id: bundle.offering.id, name: bundle.offering.name },
    deliveryType: entitlement.deliveryType,
    status: entitlement.status,
    access: {
      startsAt: entitlement.accessStartsAt.toISOString(),
      endsAt: entitlement.accessEndsAt?.toISOString() ?? null,
    },
    updatePolicy: entitlement.updatePolicy,
    orderNo: bundle.order?.orderNo ?? null,
    invoiceNo: bundle.invoiceNo,
    grantedAt: entitlement.createdAt.toISOString(),
    instructionsHtml: opts.renderRichText(bundle.offering.instructionsJson),
    versions: bundle.versions.map((v) => ({
      version: v.version,
      releasedAt: v.releasedAt.toISOString(),
      changelog: v.changelog,
    })),
    ...deliverySlice(slice),
  };
  if (bundle.subscription !== null) {
    view.subscription = subscriptionView(bundle.subscription, opts.renewalOrderNo ?? null, opts.now);
  }
  return view;
}

/** API-DEL-06 row: the entitlement plus the handler's `adminActions` (+ `cancel_subscription`). */
export function toAdminRow(
  bundle: EntitlementBundle,
  registry: DeliveryHandlerRegistry,
): EntitlementAdminRow {
  const { entitlement } = bundle;
  const handler = registry.get(entitlement.deliveryType);
  const actions: EntitlementAdminAction[] = handler.adminActions(entitlement, bundle.openTasks);
  if (bundle.subscription !== null) {
    const cancellable = bundle.subscription.status !== "cancelled";
    actions.push({
      key: "cancel_subscription",
      label: "Cancel subscription",
      apiId: "API-DEL-14",
      enabled: cancellable,
      ...(cancellable ? {} : { disabledReason: "already cancelled" }),
    });
  }
  return {
    entitlementId: entitlement.id,
    user: { id: bundle.customer.id, email: bundle.customer.email, name: bundle.customer.name },
    product: { id: bundle.product.id, name: bundle.product.name },
    offering: { id: bundle.offering.id, name: bundle.offering.name },
    deliveryType: entitlement.deliveryType,
    status: entitlement.status,
    provisioningState: entitlement.provisioningState,
    accessEndsAt: entitlement.accessEndsAt?.toISOString() ?? null,
    downloads:
      entitlement.deliveryType === "download"
        ? { used: entitlement.downloadsUsed, cap: entitlement.downloadCap }
        : null,
    licenseKeyIssued: entitlement.licenseKeyEnc !== null && entitlement.licenseKeyEnc !== "",
    orderNo: bundle.order?.orderNo ?? null,
    grantedManuallyBy: entitlement.grantedManuallyBy,
    openTasks: bundle.openTasks.length,
    adminActions: actions,
    createdAt: entitlement.createdAt.toISOString(),
  };
}
