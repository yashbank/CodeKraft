/**
 * View-model mapper for the customer Checkout screen (SCR-ACC-10) -- `modules/orders`'s
 * `CheckoutPreview` -> `components/account/types.ts`'s `CheckoutOffering`. Kept out of the page
 * and out of the screen component, per the `purchases-view.ts` convention.
 *
 * Known gaps vs. a fully fixture-populated screen (flagged here rather than fabricated):
 *  - `displayEstimate` (the "≈ in <currency>" line) is always left unset -- `previewCheckout`
 *    only returns `displayTotal` in the base currency (D-502: release 1 charges INR only, no FX
 *    conversion is wired here), so there is no non-fabricated estimate to show yet.
 *  - `renewal` is always left unset -- a subscription *offering*'s renewal period only exists once
 *    a subscription row is active; `previewCheckout` (first purchase) has nothing to compute it
 *    from. The "Renew" flow (an existing subscription hitting this same page) isn't wired in this
 *    pass -- flagged rather than guessed at.
 */
import type {
  BillingDetails,
  CheckoutOffering,
  DeliveryType,
  PaymentProvider,
} from "@/components/account/types";
import type { BillingInput, CheckoutPreview } from "@/modules/orders/types";
import {
  ALL_MANUAL_AVAILABLE,
  type ManualMethodAvailability,
} from "@/modules/payments/availability";
import type { CustomerProfileView, UserView } from "@/modules/users/types";

/**
 * `ManualPaymentMethod` (`modules/orders/types.ts`) is derived via `Array.prototype.filter`, which
 * doesn't narrow the source `payment_provider` DB enum -- it's typed as the full
 * `manual_upi | manual_bank | razorpay | stripe | paypal` union even though only the two manual
 * values are ever actually in it (release 1, D-501). Filter again here so the narrower
 * `PaymentProvider` the checkout UI understands is a real invariant, not just a cast.
 *
 * Used where Razorpay must never appear regardless of flags/config (`order-detail-view.ts`'s
 * "re-show this already-placed order's payment instructions" -- that screen only ever renders
 * manual UPI/bank instructions, untouched by the V1.1 Razorpay work). The live checkout mapper
 * below uses `toCheckoutPaymentProviders` instead, which can also admit `"razorpay"`.
 */
export function toManualPaymentProviders(methods: readonly string[]): PaymentProvider[] {
  return methods.filter((m): m is PaymentProvider => m === "manual_upi" || m === "manual_bank");
}

/**
 * Same idea as `toManualPaymentProviders`, plus the one extra gate for Razorpay (V1.1, D-501,
 * TEST MODE ONLY): an offering's `offeringPaymentMethods` row can already list `"razorpay"` (the
 * DB enum always allowed it), but it must only actually become a selectable checkout option when
 * BOTH the `provider_razorpay` feature flag is on AND `razorpaySettings.keyId`/`keySecret` are
 * configured. The caller (the checkout page, a server component) computes that boolean and
 * passes it in; this function never reaches into settings/flags itself, keeping it a pure mapper.
 */
export function toCheckoutPaymentProviders(
  methods: readonly string[],
  razorpayAvailable: boolean,
  manual: ManualMethodAvailability = ALL_MANUAL_AVAILABLE,
): PaymentProvider[] {
  return methods.filter(
    (m): m is PaymentProvider =>
      (m === "manual_upi" && manual.manual_upi) ||
      (m === "manual_bank" && manual.manual_bank) ||
      (m === "razorpay" && razorpayAvailable),
  );
}

/** Manual methods the offering accepts but whose details admin hasn't filled in yet (R8-01). */
export function unconfiguredManualMethods(
  methods: readonly string[],
  manual: ManualMethodAvailability,
): PaymentProvider[] {
  return methods.filter(
    (m): m is PaymentProvider =>
      (m === "manual_upi" && !manual.manual_upi) || (m === "manual_bank" && !manual.manual_bank),
  );
}

const PURCHASE_MODEL_LINE: Record<string, string> = {
  one_time: "One-time purchase",
  subscription: "Subscription",
  custom_quote: "Custom quote",
};

export function mapCheckoutPreviewToOffering(
  preview: CheckoutPreview,
  razorpayAvailable = false,
  manual: ManualMethodAvailability = ALL_MANUAL_AVAILABLE,
): CheckoutOffering {
  return {
    productName: preview.product.title,
    offeringName: preview.offering.title,
    purchaseModelLine:
      PURCHASE_MODEL_LINE[preview.offering.purchaseModel] ?? preview.offering.purchaseModel,
    deliveryType: preview.offering.deliveryType as DeliveryType,
    unit: preview.subtotal,
    taxLabel: preview.product.taxEnabled
      ? `GST (${(preview.taxRateBps / 100).toFixed(0)}%)`
      : "Tax",
    tax: preview.product.taxEnabled ? preview.tax : null,
    enabledMethods: toCheckoutPaymentProviders(preview.enabledMethods, razorpayAvailable, manual),
    unavailableMethods: unconfiguredManualMethods(preview.enabledMethods, manual),
    displayCurrency: preview.displayTotal.currency,
    productHref: `/products/${preview.product.slug}`,
  };
}

/**
 * The checkout/quote UI collects billing as separate `line1/line2/city/state/postalCode` fields
 * (`BillingDetails`); `createOrder`/`acceptCustomQuote` take a single `address` string
 * (`zBilling`). Joins the non-empty parts rather than dropping them.
 */
export function mapBillingToOrderInput(b: BillingDetails, email: string): BillingInput {
  const address = [b.line1, b.line2, b.city, b.state, b.postalCode].filter(Boolean).join(", ");
  return {
    name: b.name,
    email,
    country: b.country,
    company: b.company || undefined,
    address: address || undefined,
    gstNumber: b.gstNumber || undefined,
  };
}

/**
 * Prefills the checkout/quote billing form from the customer's real saved profile
 * (`getMyProfile`, `customer_profiles`), falling back to the account name/email when no profile
 * row exists yet (new customers) rather than fabricating an address.
 */
export function mapProfileToBilling(
  user: Pick<UserView, "name" | "email">,
  profile: CustomerProfileView,
): BillingDetails & { email: string } {
  const addr = profile.billingAddress;
  return {
    name: profile.billingName || user.name,
    email: user.email,
    company: profile.company ?? undefined,
    line1: addr?.line1,
    line2: addr?.line2,
    city: addr?.city,
    state: addr?.state,
    postalCode: addr?.postalCode,
    country: profile.country ?? addr?.country ?? "IN",
    gstNumber: profile.gstNumber ?? undefined,
  };
}
