"use client";

import {
  BuildingIcon,
  CheckIcon,
  ChevronDownIcon,
  LandmarkIcon,
  QrCodeIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupCard } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/_utils";
import { add, format, money, type Money } from "@/lib/money";
import { mapBillingToOrderInput } from "@/lib/account/checkout-view";
import { createOrder, previewCheckout } from "@/modules/orders/customer-mutations";
import type { CreateOrderResult } from "@/modules/orders/types";
import { Banner } from "./Banner";
import { DELIVERY_LABELS } from "./DeliveryTypeIcon";
import { PaymentInstructionsPanel } from "./PaymentInstructionsPanel";
import { ProductCover } from "./ProductCover";
import type { BillingDetails, CheckoutOffering, PaymentProvider } from "./types";

export const COUNTRIES = [
  { code: "IN", label: "India" },
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "DE", label: "Germany" },
  { code: "AE", label: "United Arab Emirates" },
  { code: "SG", label: "Singapore" },
];

const METHODS: Record<PaymentProvider, { label: string; hint: string; Icon: typeof QrCodeIcon }> = {
  manual_upi: { label: "UPI", hint: "Scan a QR with any UPI app — instant", Icon: QrCodeIcon },
  manual_bank: {
    label: "Bank transfer",
    hint: "NEFT / IMPS / RTGS — up to 1 working day",
    Icon: LandmarkIcon,
  },
};

export interface CheckoutCoupon {
  code: string;
  /** Percent off in basis points (1000 = 10%) or a fixed amount. */
  percentBps?: number;
  fixed?: Money;
}

export type CheckoutPageState =
  | "default"
  | "loading"
  | "submitting"
  | "duplicate"
  | "unavailable"
  | "unverified"
  | "rate_limited";

/** Billing details fieldset shared by checkout and the quote page (D-410: company, address, GST optional). */
export function BillingFields({
  value,
  onChange,
  emailReadOnly,
  idPrefix = "bill",
}: {
  value: BillingDetails & { email?: string };
  onChange: (next: BillingDetails & { email?: string }) => void;
  emailReadOnly?: string;
  idPrefix?: string;
}) {
  const [addressOpen, setAddressOpen] = React.useState(!!value.line1);
  const set = (patch: Partial<BillingDetails>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`} required>
          Full name
        </Label>
        <Input
          id={`${idPrefix}-name`}
          autoComplete="name"
          required
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>
      {emailReadOnly !== undefined ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-email`} required>
            Email
          </Label>
          <Input id={`${idPrefix}-email`} type="email" readOnly value={emailReadOnly} />
          <p className="text-caption text-fg-muted">From your account. Change it in Settings.</p>
        </div>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-country`} required>
          Country
        </Label>
        <Select value={value.country} onValueChange={(c) => set({ country: c })}>
          <SelectTrigger id={`${idPrefix}-country`} className="w-full">
            <SelectValue placeholder="Choose a country" />
          </SelectTrigger>
          <SelectContent>
            {COUNTRIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-company`}>Company (optional)</Label>
        <Input
          id={`${idPrefix}-company`}
          autoComplete="organization"
          value={value.company ?? ""}
          onChange={(e) => set({ company: e.target.value })}
        />
      </div>
      {value.country === "IN" ? (
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-gst`}>GST number (optional)</Label>
          <Input
            id={`${idPrefix}-gst`}
            className="font-mono uppercase"
            maxLength={15}
            aria-describedby={`${idPrefix}-gst-hint`}
            value={value.gstNumber ?? ""}
            onChange={(e) => set({ gstNumber: e.target.value.toUpperCase() })}
          />
          <p id={`${idPrefix}-gst-hint`} className="text-caption text-fg-muted">
            15-character GSTIN, e.g. 27ABCDE1234F1Z5
          </p>
        </div>
      ) : null}
      <div className="lg:col-span-2">
        {!addressOpen ? (
          <Button type="button" variant="link" onClick={() => setAddressOpen(true)}>
            Add billing address (optional)
          </Button>
        ) : (
          <fieldset className="grid gap-4 lg:grid-cols-2">
            <legend className="mb-2 text-body-sm font-semibold text-fg">
              Billing address (optional)
            </legend>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor={`${idPrefix}-line1`}>Address line 1</Label>
              <Input
                id={`${idPrefix}-line1`}
                autoComplete="address-line1"
                value={value.line1 ?? ""}
                onChange={(e) => set({ line1: e.target.value })}
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor={`${idPrefix}-line2`}>Address line 2</Label>
              <Input
                id={`${idPrefix}-line2`}
                autoComplete="address-line2"
                value={value.line2 ?? ""}
                onChange={(e) => set({ line2: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-city`}>City</Label>
              <Input
                id={`${idPrefix}-city`}
                autoComplete="address-level2"
                value={value.city ?? ""}
                onChange={(e) => set({ city: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-state`}>State</Label>
              <Input
                id={`${idPrefix}-state`}
                autoComplete="address-level1"
                value={value.state ?? ""}
                onChange={(e) => set({ state: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-postal`}>Postal code</Label>
              <Input
                id={`${idPrefix}-postal`}
                autoComplete="postal-code"
                value={value.postalCode ?? ""}
                onChange={(e) => set({ postalCode: e.target.value })}
              />
            </div>
          </fieldset>
        )}
      </div>
    </div>
  );
}

/** Radio cards for the enabled manual payment methods (docs/08 §6.2 radio cards). */
export function PaymentMethodChoice({
  methods,
  value,
  onChange,
}: {
  methods: PaymentProvider[];
  value: PaymentProvider;
  onChange: (m: PaymentProvider) => void;
}) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onChange(v as PaymentProvider)}
      aria-label="Payment method"
      className="grid gap-3 sm:grid-cols-2"
    >
      {methods.map((m) => {
        const meta = METHODS[m];
        return (
          <RadioGroupCard key={m} value={m} id={`pm-${m}`}>
            <span className="flex items-center gap-2 text-body font-semibold text-fg">
              <meta.Icon aria-hidden className="size-5 text-accent-text" />
              {meta.label}
            </span>
            <span className="text-body-sm text-fg-muted">{meta.hint}</span>
          </RadioGroupCard>
        );
      })}
    </RadioGroup>
  );
}

/**
 * SCR-ACC-10 — checkout for a single offering: steps (Billing → Review & discounts → Payment
 * method), sticky order summary with "What happens next", coupon with applied chip, totals in the
 * charge currency with a display-currency estimate. Phase 7 wires `previewOrder`/`createOrder`.
 */
export function CheckoutScreen({
  offeringId,
  offering,
  customerEmail,
  billing,
  state = "default",
  links,
}: {
  /** The offering being bought -- needed to call `previewCheckout`/`createOrder` for real. */
  offeringId: string;
  offering: CheckoutOffering;
  customerEmail: string;
  billing: BillingDetails;
  state?: CheckoutPageState;
  links: { dashboard: string; verify: string };
}) {
  const [bill, setBill] = React.useState<BillingDetails>(billing);
  const [save, setSave] = React.useState(true);
  const [code, setCode] = React.useState("");
  const [appliedCode, setAppliedCode] = React.useState<string | null>(null);
  const [couponError, setCouponError] = React.useState<string | null>(null);
  const [checkingCoupon, setCheckingCoupon] = React.useState(false);
  const [method, setMethod] = React.useState<PaymentProvider>(
    offering.enabledMethods[0] ?? "manual_upi",
  );
  const [consent, setConsent] = React.useState(false);
  const [summaryOpen, setSummaryOpen] = React.useState(false);
  const [placing, setPlacing] = React.useState(false);
  const [order, setOrder] = React.useState<CreateOrderResult | null>(null);

  /**
   * Real server-computed totals, seeded from the `previewCheckout` the page already ran and
   * replaced wholesale by another `previewCheckout` call when a coupon is applied/removed --
   * never recomputed client-side (no hardcoded tax rate; `previewCheckout` already applies the
   * product's real rate and the coupon's real discount, docs/06 API-COM-01).
   */
  const [numbers, setNumbers] = React.useState<{
    subtotal: Money;
    discount: Money;
    tax: Money | null;
    total: Money;
  }>({
    subtotal: offering.unit,
    discount: money(0, offering.unit.currency),
    tax: offering.tax,
    total: offering.tax ? add(offering.unit, offering.tax) : offering.unit,
  });
  const { subtotal, discount, tax, total } = numbers;

  async function applyCoupon() {
    if (!code || checkingCoupon) return;
    setCheckingCoupon(true);
    setCouponError(null);
    const result = await previewCheckout({ offeringId, couponCode: code });
    setCheckingCoupon(false);
    if (!result.ok) {
      setCouponError(result.error.message);
      return;
    }
    if (!result.data.coupon) {
      setCouponError(result.data.warnings[0] ?? "That code isn't valid for this offering.");
      return;
    }
    setAppliedCode(result.data.coupon.code);
    setNumbers({
      subtotal: result.data.subtotal,
      discount: result.data.discount,
      tax: offering.tax ? result.data.tax : null,
      total: result.data.total,
    });
  }

  async function removeCoupon() {
    setAppliedCode(null);
    setCode("");
    setCouponError(null);
    const result = await previewCheckout({ offeringId });
    setNumbers(
      result.ok
        ? {
            subtotal: result.data.subtotal,
            discount: result.data.discount,
            tax: offering.tax ? result.data.tax : null,
            total: result.data.total,
          }
        : {
            subtotal: offering.unit,
            discount: money(0, offering.unit.currency),
            tax: offering.tax,
            total: offering.tax ? add(offering.unit, offering.tax) : offering.unit,
          },
    );
  }

  async function handlePlaceOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!consent || placing) return;
    setPlacing(true);
    const result = await createOrder({
      offeringId,
      couponCode: appliedCode ?? undefined,
      paymentMethod: method,
      billing: mapBillingToOrderInput(bill, customerEmail),
    });
    setPlacing(false);
    if (result.ok) {
      setOrder(result.data);
      toast.success(`Order ${result.data.orderNo} placed`);
    } else {
      toast.error(result.error.message);
    }
  }

  if (order) {
    return (
      <PaymentInstructionsPanel
        orderNo={order.orderNo}
        paymentId={order.payment.paymentId}
        instructions={order.payment.instructions}
        expiresAt={order.expiresAt}
        dashboardHref={links.dashboard}
      />
    );
  }

  if (state === "duplicate") {
    return (
      <Banner
        tone="info"
        title="You already own this"
        action={
          <Button size="sm" asChild>
            <Link href={links.dashboard}>Open in dashboard</Link>
          </Button>
        }
      >
        {offering.productName} · {offering.offeringName} is already in your purchases (one copy per
        account).
      </Banner>
    );
  }
  if (state === "unavailable") {
    return (
      <Banner
        tone="warning"
        title="This offering can't be purchased right now"
        action={
          <Button size="sm" variant="secondary" asChild>
            <Link href={offering.productHref}>Back to product</Link>
          </Button>
        }
      >
        It may be coming soon, inactive or quote-only. Ask us for a quote from the product page.
      </Banner>
    );
  }
  if (state === "unverified") {
    return (
      <Banner
        tone="warning"
        title="Verify your email to continue"
        action={
          <Button size="sm" asChild>
            <Link href={links.verify}>Verify email</Link>
          </Button>
        }
      >
        Purchases unlock once your email is verified. We can resend the link.
      </Banner>
    );
  }

  const loading = state === "loading";
  const submitting = state === "submitting" || placing;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-h1 text-fg">
          {offering.renewal ? `Renew ${offering.productName}` : "Checkout"}
        </h1>
        {offering.renewal ? (
          <p className="text-body text-fg-muted">
            {offering.offeringName} · New period: {offering.renewal.periodLabel}
          </p>
        ) : null}
      </div>

      {state === "rate_limited" ? (
        <Banner tone="danger">Too many attempts. Try again in a few minutes.</Banner>
      ) : null}

      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-body-sm font-semibold text-fg lg:hidden"
        aria-expanded={summaryOpen}
        aria-controls="checkout-summary"
        onClick={() => setSummaryOpen((o) => !o)}
      >
        Order summary · {format(total)}
        <ChevronDownIcon
          aria-hidden
          className={cn("size-4 transition-transform", summaryOpen && "rotate-180")}
        />
      </button>

      <div className="grid gap-6 lg:grid-cols-12">
        <form
          className="space-y-6 lg:col-span-7"
          aria-busy={submitting || undefined}
          onSubmit={handlePlaceOrder}
        >
          <Step n={1} title="Billing details">
            <BillingFields value={bill} onChange={setBill} emailReadOnly={customerEmail} />
            <div className="flex items-center gap-2">
              <Checkbox
                id="save-profile"
                checked={save}
                onCheckedChange={(v) => setSave(v === true)}
              />
              <Label htmlFor="save-profile" className="font-medium">
                Save to my profile
              </Label>
            </div>
          </Step>

          <Step n={2} title="Review & discounts">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="coupon">Coupon (optional)</Label>
                <Input
                  id="coupon"
                  className="font-mono uppercase"
                  value={code}
                  disabled={!!appliedCode}
                  aria-invalid={!!couponError || undefined}
                  aria-describedby={couponError ? "coupon-error" : undefined}
                  onChange={(e) => {
                    setCode(e.target.value.toUpperCase());
                    setCouponError(null);
                  }}
                />
                {couponError ? (
                  <p id="coupon-error" className="text-caption text-danger">
                    {couponError}
                  </p>
                ) : null}
              </div>
              {appliedCode ? (
                <Badge tone="success" className="h-10 gap-2 px-3 text-body-sm">
                  −{format(discount)} ({appliedCode})
                  <button
                    type="button"
                    aria-label={`Remove coupon ${appliedCode}`}
                    onClick={() => void removeCoupon()}
                  >
                    <XIcon aria-hidden className="size-3.5" />
                  </button>
                </Badge>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!code || checkingCoupon}
                  onClick={() => void applyCoupon()}
                >
                  {checkingCoupon ? "Checking…" : "Apply"}
                </Button>
              )}
            </div>
            <table className="w-full text-body-sm">
              <caption className="sr-only">Line items</caption>
              <thead>
                <tr className="text-left text-overline tracking-wider text-fg-muted uppercase">
                  <th scope="col" className="py-2 font-semibold">
                    Item
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    Unit
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    Discount
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    Tax
                  </th>
                  <th scope="col" className="py-2 text-right font-semibold">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="py-3 text-fg">
                    {offering.productName}
                    <span className="block text-caption text-fg-muted">
                      {offering.offeringName}
                    </span>
                  </td>
                  <td className="py-3 text-right font-mono tnum">{format(subtotal)}</td>
                  <td className="py-3 text-right font-mono tnum text-fg-muted">
                    {appliedCode ? `−${format(discount)}` : "—"}
                  </td>
                  <td className="py-3 text-right text-fg-muted">
                    {tax ? `${offering.taxLabel} · ${format(tax)}` : "No tax"}
                  </td>
                  <td className="py-3 text-right font-mono tnum font-semibold text-fg">
                    {format(total)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-caption text-fg-muted">
              You&apos;ll be charged in INR. Other currencies are shown as estimates.
            </p>
          </Step>

          <Step n={3} title="Payment method">
            <PaymentMethodChoice
              methods={offering.enabledMethods}
              value={method}
              onChange={setMethod}
            />
            <div className="flex items-start gap-2">
              <Checkbox
                id="consent"
                required
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5"
              />
              <Label htmlFor="consent" className="items-start leading-snug font-medium">
                <span>
                  I agree to the{" "}
                  <Link href="/legal/terms" className="text-accent-text underline">
                    Terms of service
                  </Link>
                  ,{" "}
                  <Link href="/legal/refunds" className="text-accent-text underline">
                    Refund &amp; cancellation policy
                  </Link>{" "}
                  and{" "}
                  <Link href="/legal/license" className="text-accent-text underline">
                    Product license terms
                  </Link>
                  <span aria-hidden className="text-danger">
                    {" "}
                    *
                  </span>
                </span>
              </Label>
            </div>
            <div className="sticky bottom-0 -mx-4 border-t border-border bg-canvas/95 p-4 backdrop-blur lg:static lg:m-0 lg:border-0 lg:bg-transparent lg:p-0">
              <Button
                type="submit"
                size="lg"
                className="w-full lg:w-auto"
                loading={submitting}
                disabled={!consent && !submitting}
              >
                {submitting ? "Placing order…" : `Place order · ${format(total)}`}
              </Button>
              <p className="mt-2 text-caption text-fg-subtle">
                Unpaid orders are cancelled automatically after 7 days.
              </p>
            </div>
          </Step>
        </form>

        <aside
          id="checkout-summary"
          className={cn("space-y-4 lg:col-span-5 lg:block", summaryOpen ? "block" : "hidden")}
        >
          <div className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-1 lg:sticky lg:top-20">
            {loading ? (
              <div className="space-y-3" aria-busy="true">
                <Skeleton className="h-16" />
                <Skeleton className="h-24" />
              </div>
            ) : (
              <>
                <div className="flex gap-3">
                  <ProductCover name={offering.productName} className="size-14" />
                  <div className="min-w-0">
                    <p className="text-body font-semibold text-fg">{offering.productName}</p>
                    <p className="text-body-sm text-fg-muted">{offering.offeringName}</p>
                    <p className="text-caption text-fg-muted">
                      {offering.purchaseModelLine} · {DELIVERY_LABELS[offering.deliveryType]}
                    </p>
                  </div>
                </div>
                <dl className="space-y-1.5 border-t border-border pt-4 text-body-sm">
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">Subtotal</dt>
                    <dd className="font-mono tnum">{format(subtotal)}</dd>
                  </div>
                  {appliedCode ? (
                    <div className="flex justify-between text-success">
                      <dt>Discount ({appliedCode})</dt>
                      <dd className="font-mono tnum">−{format(discount)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between">
                    <dt className="text-fg-muted">{tax ? offering.taxLabel : "Tax"}</dt>
                    <dd className="font-mono tnum">{tax ? format(tax) : "No tax"}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 text-body font-semibold text-fg">
                    <dt>Total</dt>
                    <dd className="font-mono tnum">{format(total)}</dd>
                  </div>
                  {offering.displayEstimate ? (
                    <div className="flex justify-between text-caption text-fg-muted">
                      <dt>≈ in {offering.displayCurrency}</dt>
                      <dd className="font-mono tnum">≈ {format(offering.displayEstimate)}</dd>
                    </div>
                  ) : null}
                </dl>
                <div className="border-t border-border pt-4">
                  <p className="mb-2 text-overline font-semibold tracking-wider text-fg-muted uppercase">
                    What happens next
                  </p>
                  <ol className="space-y-2 text-body-sm">
                    {[
                      "Place order",
                      `Pay via ${METHODS[method].label}`,
                      "Submit your reference",
                      "We confirm (usually < 1 working day)",
                      "Access unlocked",
                    ].map((s, i) => (
                      <li key={s} className="flex items-center gap-2 text-fg-muted">
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                            i === 0
                              ? "border-accent bg-accent text-accent-fg"
                              : "border-border-strong",
                          )}
                        >
                          {i === 0 ? <CheckIcon aria-hidden className="size-3" /> : i + 1}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ol>
                </div>
                <p className="flex items-center gap-1.5 text-caption text-fg-subtle">
                  <BuildingIcon aria-hidden className="size-3.5" /> Invoice issued on confirmation.
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section
      aria-labelledby={`step-${n}`}
      className="space-y-4 rounded-lg border border-border bg-surface p-5 shadow-1"
    >
      <h2 id={`step-${n}`} className="flex items-center gap-3 text-h4 text-fg">
        <span
          aria-hidden
          className="flex size-7 items-center justify-center rounded-full bg-accent text-caption font-semibold text-accent-fg"
        >
          {n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
