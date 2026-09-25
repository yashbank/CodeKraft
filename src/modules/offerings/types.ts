/**
 * Offerings domain types — docs/05 §3, docs/06 API-CAT-03/04/05, MASTER_SPEC §4.2 (prices live on
 * offerings, never products).
 */
import type {
  billingInterval,
  deliveryType,
  offeringStatus,
  paymentMethod,
  purchaseModel,
  updatePolicy,
  DeliveryConfig,
  ServiceStep,
} from "../../../drizzle/schema/offerings";
import type { Money } from "@/lib/money";
import type { TiptapDoc } from "../../../drizzle/schema/catalog";
import { enumTuple } from "../catalog/types";

export type {
  Offering,
  OfferingPaymentMethod,
  OfferingPrice,
} from "../../../drizzle/schema/offerings";
export type { DeliveryConfig, ServiceStep };

export type PurchaseModelValue = (typeof purchaseModel.enumValues)[number];
export const PURCHASE_MODELS = enumTuple<PurchaseModelValue>()([
  "one_time",
  "subscription",
  "custom_quote",
] as const);

export type BillingIntervalValue = (typeof billingInterval.enumValues)[number];
export const BILLING_INTERVALS = enumTuple<BillingIntervalValue>()([
  "monthly",
  "quarterly",
  "annual",
] as const);

export type DeliveryTypeValue = (typeof deliveryType.enumValues)[number];
export const DELIVERY_TYPES = enumTuple<DeliveryTypeValue>()([
  "saas",
  "hosted",
  "download",
  "license",
  "service",
  "custom",
] as const);

export type UpdatePolicyValue = (typeof updatePolicy.enumValues)[number];
export const UPDATE_POLICIES = enumTuple<UpdatePolicyValue>()([
  "all_free",
  "during_access",
  "major_paid",
] as const);

export type PaymentMethodValue = (typeof paymentMethod.enumValues)[number];
export const PAYMENT_METHODS = enumTuple<PaymentMethodValue>()([
  "manual_upi",
  "manual_bank",
  "razorpay",
  "stripe",
  "paypal",
] as const);
/** Methods that need no gateway flag (release 1, D-501). */
export const MANUAL_PAYMENT_METHODS: readonly PaymentMethodValue[] = ["manual_upi", "manual_bank"];

export type OfferingStatusValue = (typeof offeringStatus.enumValues)[number];
export const OFFERING_STATUSES = enumTuple<OfferingStatusValue>()(["active", "inactive"] as const);

export type ProvisioningMode = NonNullable<DeliveryConfig["provisioning"]>;
export const PROVISIONING_MODES = [
  "manual",
  "automated",
] as const satisfies readonly ProvisioningMode[];

/** Price row as returned to the UI: base currency plus a display-currency conversion (D-502). */
export interface OfferingPriceView {
  currency: Money["currency"];
  amountMinor: number;
  compareAtMinor: number | null;
  /** True when the row came from `offering_prices`; false when converted via `fx_rates`. */
  explicit: boolean;
}

/** API-CAT-31 offering block: prices in display currency + base, enabled methods. */
export interface OfferingView {
  id: string;
  slug: string;
  name: string;
  position: number;
  isDefault: boolean;
  purchaseModel: PurchaseModelValue;
  billingInterval: BillingIntervalValue | null;
  trialDays: number | null;
  licenseType: string | null;
  deliveryType: DeliveryTypeValue;
  deliveryConfig: DeliveryConfig;
  serviceSteps: ServiceStep[] | null;
  instructions: TiptapDoc | null;
  status: OfferingStatusValue;
  price: {
    base: Money;
    display: Money;
    compareAt: Money | null;
    displayIsConverted: boolean;
  } | null;
  prices: OfferingPriceView[];
  paymentMethods: PaymentMethodValue[];
}
