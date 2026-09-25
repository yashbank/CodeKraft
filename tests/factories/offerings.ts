/**
 * Offering factory (docs/05 §3): offering + base-currency price (D-502) + payment methods (D-110).
 * Money is `{ amountMinor, currency }` in minor units, never floats (MASTER_SPEC §4.8).
 */
import { eq } from "drizzle-orm";

import { type Currency, assertMinor } from "@/lib/money";
import {
  type DeliveryConfig,
  type DeliveryTypeValue,
  type Offering,
  type OfferingPrice,
  type PaymentMethodValue,
  type ServiceStep,
  offeringPaymentMethods,
  offeringPrices,
  offerings,
} from "../../drizzle/schema/offerings";
import { createProduct } from "./catalog";
import { type FactoryDb, one, seqLabel, toFactoryDb } from "./context";

export type PurchaseModel = Offering["purchaseModel"];
export type BillingInterval = NonNullable<Offering["billingInterval"]>;

export interface PriceInput {
  amountMinor: number;
  currency?: Currency;
  compareAtMinor?: number | null;
}

export interface CreateOfferingOptions {
  /** Default: a new published product. */
  productId?: string;
  name?: string;
  slug?: string;
  position?: number;
  isDefault?: boolean;
  purchaseModel?: PurchaseModel;
  /** Default `monthly` for subscriptions, `null` otherwise. */
  billingInterval?: BillingInterval | null;
  trialDays?: number | null;
  licenseType?: string | null;
  deliveryType?: DeliveryTypeValue;
  deliveryConfig?: DeliveryConfig;
  serviceSteps?: ServiceStep[] | null;
  status?: Offering["status"];
  /** Base price (default ₹999.00 INR). Ignored when `prices` is given. */
  price?: PriceInput;
  /** Full price list; the first entry is the base currency row. */
  prices?: readonly PriceInput[];
  /** Default `['manual_upi', 'manual_bank']`. */
  methods?: readonly PaymentMethodValue[];
}

export type OfferingWithPrices = Offering & {
  prices: OfferingPrice[];
  methods: PaymentMethodValue[];
};

export const DEFAULT_PAYMENT_METHODS: readonly PaymentMethodValue[] = ["manual_upi", "manual_bank"];

export async function createOffering(
  opts: CreateOfferingOptions = {},
  db: FactoryDb = toFactoryDb(),
): Promise<OfferingWithPrices> {
  const productId = opts.productId ?? (await createProduct({}, db)).id;
  const label = seqLabel("offering");
  const purchaseModel = opts.purchaseModel ?? "one_time";
  const deliveryType = opts.deliveryType ?? "download";
  const priceList = opts.prices ?? [opts.price ?? { amountMinor: 99_900, currency: "INR" }];
  const methods = opts.methods ?? DEFAULT_PAYMENT_METHODS;

  const offering = one(
    await db
      .insert(offerings)
      .values({
        productId,
        name: opts.name ?? `Offering ${label.slice(-4)}`,
        slug: opts.slug ?? label,
        position: opts.position ?? 0,
        isDefault: opts.isDefault ?? true,
        purchaseModel,
        billingInterval:
          opts.billingInterval === undefined
            ? purchaseModel === "subscription"
              ? "monthly"
              : null
            : opts.billingInterval,
        trialDays: opts.trialDays ?? null,
        licenseType: opts.licenseType ?? (deliveryType === "license" ? "single_site" : null),
        deliveryType,
        deliveryConfig:
          opts.deliveryConfig ??
          (deliveryType === "download"
            ? { downloadCap: 3, accessMonths: null, updatePolicy: "all_free" }
            : { provisioning: "manual", accessMonths: null, updatePolicy: "during_access" }),
        serviceSteps: opts.serviceSteps ?? null,
        status: opts.status ?? "active",
      })
      .returning(),
    "offerings",
  );

  const prices = await db
    .insert(offeringPrices)
    .values(
      priceList.map((p) => ({
        offeringId: offering.id,
        currency: p.currency ?? "INR",
        amountMinor: assertMinor(p.amountMinor),
        compareAtMinor: p.compareAtMinor ?? null,
      })),
    )
    .returning();

  if (methods.length > 0) {
    await db
      .insert(offeringPaymentMethods)
      .values(methods.map((method) => ({ offeringId: offering.id, method })));
  }
  return { ...offering, prices, methods: [...methods] };
}

/** Load an offering with its prices/methods (used when a factory receives only an id). */
export async function findOffering(
  offeringId: string,
  db: FactoryDb = toFactoryDb(),
): Promise<OfferingWithPrices | null> {
  const [row] = await db.select().from(offerings).where(eq(offerings.id, offeringId)).limit(1);
  if (row === undefined) return null;
  const [prices, methodRows] = await Promise.all([
    db.select().from(offeringPrices).where(eq(offeringPrices.offeringId, offeringId)),
    db
      .select()
      .from(offeringPaymentMethods)
      .where(eq(offeringPaymentMethods.offeringId, offeringId)),
  ]);
  return { ...row, prices, methods: methodRows.map((m) => m.method) };
}

/** The offering's price row in `currency` (throws when the offering is not sold in it). */
export function priceIn(offering: OfferingWithPrices, currency: Currency): OfferingPrice {
  const price = offering.prices.find((p) => p.currency === currency);
  if (price === undefined) {
    throw new Error(`offering ${offering.slug} has no ${currency} price`);
  }
  return price;
}
