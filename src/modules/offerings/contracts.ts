/**
 * Offerings contracts — docs/06 API-CAT-03 (`upsertOffering` / `deleteOffering`), API-CAT-04
 * (`setOfferingPrices`), API-CAT-05 (`setOfferingPaymentMethods`), D-110, D-502, D-408.
 */
import { z } from "zod";
import type { RequestContext } from "@/lib/authz/context";
import type { DbOrTx, TxCtx } from "@/lib/db";
import type { Currency } from "@/lib/money";
import { currencySchema, richTextSchema, slugSchema, uuidSchema } from "@/modules/_shared/zod";
import { positionSchema, text } from "../catalog/contracts";
import {
  BILLING_INTERVALS,
  DELIVERY_TYPES,
  OFFERING_STATUSES,
  PAYMENT_METHODS,
  PROVISIONING_MODES,
  PURCHASE_MODELS,
  UPDATE_POLICIES,
  type Offering,
  type OfferingPrice,
  type OfferingView,
  type PaymentMethodValue,
} from "./types";

export const purchaseModelSchema = z.enum(PURCHASE_MODELS);
export const billingIntervalSchema = z.enum(BILLING_INTERVALS);
export const deliveryTypeSchema = z.enum(DELIVERY_TYPES);
export const updatePolicySchema = z.enum(UPDATE_POLICIES);
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export const offeringStatusSchema = z.enum(OFFERING_STATUSES);

/** `offerings.delivery_config` (docs/05 §3; keys depend on `deliveryType`). */
export const deliveryConfigSchema = z.strictObject({
  provisioning: z.enum(PROVISIONING_MODES),
  downloadCap: z.number().int().min(1).max(1000).optional(),
  accessMonths: z.number().int().min(1).max(600).nullable().optional(),
  updatePolicy: updatePolicySchema,
  instructionsJson: richTextSchema.optional(),
  repoUrl: z.url({ protocol: /^https?$/ }).optional(),
  appUrl: z.url({ protocol: /^https?$/ }).optional(),
  customerHosted: z.boolean().optional(),
});

export const serviceStepSchema = z.strictObject({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_]+$/),
  title: text(120),
  description: text(500).optional(),
});

/**
 * API-CAT-03 `upsertOffering`. Cross-field rules stated in the row are enforced here;
 * `automated` provisioning additionally needs the `automated_provisioning` flag (service).
 */
export const upsertOfferingSchema = z
  .strictObject({
    productId: uuidSchema,
    offeringId: uuidSchema.optional(),
    name: text(120),
    slug: slugSchema,
    position: positionSchema,
    isDefault: z.boolean(),
    purchaseModel: purchaseModelSchema,
    billingInterval: billingIntervalSchema.optional(),
    trialDays: z.number().int().min(0).max(365).optional(),
    licenseType: text(80).optional(),
    deliveryType: deliveryTypeSchema,
    deliveryConfig: deliveryConfigSchema,
    serviceSteps: z.array(serviceStepSchema).max(50).optional(),
    instructionsJson: richTextSchema.optional(),
    status: offeringStatusSchema,
  })
  .refine((o) => o.purchaseModel !== "subscription" || o.billingInterval !== undefined, {
    message: "subscription offerings need a billingInterval",
    path: ["billingInterval"],
  })
  .refine((o) => o.deliveryType !== "service" || (o.serviceSteps?.length ?? 0) >= 1, {
    message: "service offerings need at least one step",
    path: ["serviceSteps"],
  });
export type UpsertOfferingInput = z.infer<typeof upsertOfferingSchema>;

/** API-CAT-03 `deleteOffering` — hard delete only with zero `order_items`, else `inactive`. */
export const deleteOfferingSchema = z.strictObject({ offeringId: uuidSchema });

export const offeringPriceInputSchema = z
  .strictObject({
    currency: currencySchema,
    amountMinor: z.number().int().nonnegative(),
    compareAtMinor: z.number().int().nonnegative().optional(),
  })
  .refine((p) => p.compareAtMinor === undefined || p.compareAtMinor > p.amountMinor, {
    message: "compareAtMinor must exceed amountMinor",
    path: ["compareAtMinor"],
  });

/** API-CAT-04 `setOfferingPrices` — replace set; the base-currency row is checked by the service. */
export const setOfferingPricesSchema = z.strictObject({
  offeringId: uuidSchema,
  prices: z
    .array(offeringPriceInputSchema)
    .min(1)
    .max(5)
    .refine((rows) => new Set(rows.map((r) => r.currency)).size === rows.length, {
      message: "one price per currency",
    }),
});
export type SetOfferingPricesInput = z.infer<typeof setOfferingPricesSchema>;

/** API-CAT-05 `setOfferingPaymentMethods` (gateway methods need their flag, checked by the service). */
export const setOfferingPaymentMethodsSchema = z.strictObject({
  offeringId: uuidSchema,
  methods: z
    .array(paymentMethodSchema)
    .min(1)
    .max(PAYMENT_METHODS.length)
    .refine((m) => new Set(m).size === m.length, { message: "duplicate method" }),
});
export type SetOfferingPaymentMethodsInput = z.infer<typeof setOfferingPaymentMethodsSchema>;

/** Tags revalidated after any offering mutation on a published product (docs/06 §1.10). */
export const OFFERINGS_CACHE_TAGS = {
  upsertOffering: ["catalog"],
  deleteOffering: ["catalog"],
  setOfferingPrices: ["catalog"],
  setOfferingPaymentMethods: ["catalog"],
} as const satisfies Record<string, readonly string[]>;

export interface OfferingsService {
  /** API-CAT-03 */
  upsertOffering(
    ctx: RequestContext,
    input: UpsertOfferingInput,
    tx?: DbOrTx,
  ): Promise<{ offering: Offering }>;
  /** API-CAT-03 — returns the resulting state (`deleted` or demoted to `inactive`). */
  deleteOffering(
    ctx: RequestContext,
    input: z.infer<typeof deleteOfferingSchema>,
    tx?: DbOrTx,
  ): Promise<{ result: "deleted" | "inactive" }>;
  /** API-CAT-04 */
  setOfferingPrices(
    ctx: RequestContext,
    input: SetOfferingPricesInput,
    tx?: DbOrTx,
  ): Promise<{ prices: OfferingPrice[] }>;
  /** API-CAT-05 */
  setOfferingPaymentMethods(
    ctx: RequestContext,
    input: SetOfferingPaymentMethodsInput,
    tx?: DbOrTx,
  ): Promise<{ methods: PaymentMethodValue[] }>;
  /** Internal read used by catalog (API-CAT-19/31) and orders: offerings with prices in a display currency. */
  listForProduct(
    productId: string,
    displayCurrency: Currency,
    tx?: DbOrTx,
  ): Promise<OfferingView[]>;
  /** Internal readiness check for API-CAT-11: ≥ 1 active offering with base price and ≥ 1 method. */
  isPublishReady(productId: string, tx: TxCtx): Promise<boolean>;
}
