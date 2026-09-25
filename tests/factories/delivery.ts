/**
 * Entitlement & subscription factories (docs/05 §6). An entitlement without `orderItemId` is a
 * manual grant (D-1108); a subscription always hangs off an entitlement (D-521).
 */
import type { User } from "../../drizzle/schema/auth";
import type { UpdatePolicyValue, DeliveryTypeValue } from "../../drizzle/schema/offerings";
import {
  type Entitlement,
  type Subscription,
  entitlements,
  subscriptions,
} from "../../drizzle/schema/delivery";
import { type FactoryDb, addDays, addMonths, one, toFactoryDb } from "./context";
import {
  type BillingInterval,
  type OfferingWithPrices,
  createOffering,
  findOffering,
} from "./offerings";
import { createUser } from "./users";

export type EntitlementStatus = Entitlement["status"];

export interface CreateEntitlementOptions {
  user?: Pick<User, "id">;
  userId?: string;
  offering?: Pick<OfferingWithPrices, "id" | "productId" | "deliveryType" | "deliveryConfig">;
  offeringId?: string;
  /** Default: the offering's delivery type. */
  deliveryType?: DeliveryTypeValue;
  status?: EntitlementStatus;
  orderItemId?: string | null;
  updatePolicy?: UpdatePolicyValue;
  accessStartsAt?: Date;
  /** null = lifetime (default). */
  accessEndsAt?: Date | null;
  downloadCap?: number | null;
  downloadsUsed?: number;
  provisioningState?: Entitlement["provisioningState"];
  grantedManuallyBy?: string | null;
}

export async function createEntitlement(
  opts: CreateEntitlementOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<Entitlement> {
  const userId = opts.user?.id ?? opts.userId ?? (await createUser({ emailVerified: true }, db)).id;
  let offering = opts.offering;
  if (offering === undefined) {
    offering =
      opts.offeringId === undefined
        ? await createOffering({}, db)
        : ((await findOffering(opts.offeringId, db)) ?? undefined);
    if (offering === undefined)
      throw new Error(`createEntitlement: offering ${opts.offeringId} not found`);
  }
  const deliveryType = opts.deliveryType ?? offering.deliveryType;
  const status = opts.status ?? "active";
  return one(
    await db
      .insert(entitlements)
      .values({
        userId,
        offeringId: offering.id,
        orderItemId: opts.orderItemId ?? null,
        productId: offering.productId,
        deliveryType,
        status,
        accessStartsAt: opts.accessStartsAt ?? new Date(),
        accessEndsAt: opts.accessEndsAt ?? null,
        updatePolicy: opts.updatePolicy ?? offering.deliveryConfig.updatePolicy ?? "all_free",
        downloadCap:
          opts.downloadCap === undefined
            ? deliveryType === "download"
              ? (offering.deliveryConfig.downloadCap ?? 3)
              : null
            : opts.downloadCap,
        downloadsUsed: opts.downloadsUsed ?? 0,
        provisioningState:
          opts.provisioningState ??
          (deliveryType === "saas" || deliveryType === "hosted" ? "done" : "n/a"),
        grantedManuallyBy: opts.grantedManuallyBy ?? null,
        revokedAt: status === "revoked" ? new Date() : null,
        revokeReason: status === "revoked" ? "factory: revoked" : null,
      })
      .returning(),
    "entitlements",
  );
}

export interface CreateSubscriptionOptions {
  /** Default: a new `saas` entitlement on a monthly subscription offering. */
  entitlement?: Pick<Entitlement, "id">;
  entitlementId?: string;
  interval?: BillingInterval;
  status?: Subscription["status"];
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
  renewalOrderId?: string | null;
  /** Buyer for the default entitlement. */
  userId?: string;
}

const INTERVAL_MONTHS: Record<BillingInterval, number> = { monthly: 1, quarterly: 3, annual: 12 };

export async function createSubscription(
  opts: CreateSubscriptionOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<Subscription> {
  const interval = opts.interval ?? "monthly";
  let entitlementId = opts.entitlement?.id ?? opts.entitlementId;
  if (entitlementId === undefined) {
    const offering = await createOffering(
      { purchaseModel: "subscription", billingInterval: interval, deliveryType: "saas" },
      db,
    );
    entitlementId = (await createEntitlement({ offering, userId: opts.userId }, db)).id;
  }
  const status = opts.status ?? "active";
  const start = opts.currentPeriodStart ?? new Date();
  const end = opts.currentPeriodEnd ?? addMonths(start, INTERVAL_MONTHS[interval]);
  return one(
    await db
      .insert(subscriptions)
      .values({
        entitlementId,
        interval,
        currentPeriodStart: start,
        currentPeriodEnd: end,
        graceUntil: status === "past_due" ? addDays(end, 7) : null,
        status,
        cancelAtPeriodEnd: opts.cancelAtPeriodEnd ?? false,
        renewalOrderId: opts.renewalOrderId ?? null,
      })
      .returning(),
    "subscriptions",
  );
}
