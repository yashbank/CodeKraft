"use client";

import { ExternalLinkIcon, HeartIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupCard } from "@/components/ui/radio-group";
import { cn } from "@/components/ui/_utils";

import {
  BILLING_INTERVAL_LABEL,
  DELIVERY_HINT,
  PURCHASE_MODEL_LABEL,
  UPDATE_POLICY_LABEL,
} from "../_format";
import { InquirySheet } from "../InquirySheet";
import { PriceBlock } from "../PriceBlock";
import type { OfferingView, ProductDetail, ServiceOption } from "../types";

export interface OfferingPanelProps {
  product: ProductDetail;
  serviceOptions: ServiceOption[];
  /** Customer state (P7): owned one-time offering ids / active subscription ids. */
  ownedOfferingIds?: string[];
  wishlisted?: boolean;
  /** Visitors are sent to login with `returnTo`; customers go straight to checkout. */
  signedIn?: boolean;
}

function ctaLabel(o: OfferingView): string {
  if (o.purchaseModel === "custom_quote") return "Request a quote";
  if (o.purchaseModel === "subscription") return "Subscribe";
  return "Buy now";
}

/**
 * Sticky summary card + offering selector — docs/08 §6.12 / SCR-SITE-04. Radio cards (one per
 * active offering) drive price, delivery hint, update policy and the Buy target
 * (`/checkout/[offeringId]`); custom-quote and customisation open the `InquirySheet`
 * (`source='product_cta'`). A sticky bottom bar duplicates price + CTA on phones; the in-flow
 * CTA is `aria-hidden` while the bar is visible so there is one tab stop.
 */
export function OfferingPanel({
  product,
  serviceOptions,
  ownedOfferingIds = [],
  wishlisted,
  signedIn = false,
}: OfferingPanelProps) {
  const offerings = product.offerings;
  const [selectedId, setSelectedId] = useState(offerings[0]?.id ?? "");
  const [sheet, setSheet] = useState<null | "quote" | "customise">(null);
  const [barVisible, setBarVisible] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) =>
      setBarVisible(!(entries[0]?.isIntersecting ?? true)),
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const selected = offerings.find((o) => o.id === selectedId) ?? offerings[0];
  const owned = selected ? ownedOfferingIds.includes(selected.id) : false;
  const checkoutHref = selected
    ? signedIn
      ? `/checkout/${selected.id}`
      : `/auth/login?returnTo=${encodeURIComponent(`/products/${product.slug}?offering=${selected.id}`)}`
    : "#";

  const primaryCta = (extraClass?: string) => {
    if (product.isComingSoon) {
      return (
        <Button type="button" variant="secondary" size="lg" className={cn("w-full", extraClass)}>
          <HeartIcon aria-hidden /> Notify me
        </Button>
      );
    }
    if (!selected) return null;
    if (owned) {
      return selected.purchaseModel === "subscription" ? (
        <Button asChild variant="secondary" size="lg" className={cn("w-full", extraClass)}>
          <Link href="/account/purchases">Manage subscription</Link>
        </Button>
      ) : (
        <Button asChild variant="secondary" size="lg" className={cn("w-full", extraClass)}>
          <Link href="/account/purchases">You own this — open in dashboard</Link>
        </Button>
      );
    }
    if (selected.purchaseModel === "custom_quote") {
      return (
        <Button
          type="button"
          size="lg"
          className={cn("w-full", extraClass)}
          onClick={() => setSheet("quote")}
        >
          Request a quote
        </Button>
      );
    }
    return (
      <Button asChild size="lg" className={cn("w-full", extraClass)}>
        <Link href={checkoutHref}>{ctaLabel(selected)}</Link>
      </Button>
    );
  };

  return (
    <>
      <div className="rounded-xl border border-border bg-surface p-5 shadow-glow-soft lg:sticky lg:top-24 lg:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="neutral">{product.category.name}</Badge>
          {product.isFeatured ? <Badge tone="accent">Featured</Badge> : null}
          {product.isComingSoon ? <Badge tone="warning">Coming soon</Badge> : null}
          <Badge tone="ghost">Version {product.version}</Badge>
        </div>
        <h1 className="mt-4 font-display text-h1">{product.name}</h1>
        <p className="mt-2 text-body text-fg-muted">{product.shortDescription}</p>

        {product.isComingSoon ? (
          <p className="mt-5 rounded-md bg-warning-soft px-4 py-3 text-body-sm text-warning">
            Coming soon — add to wishlist to be notified.
          </p>
        ) : offerings.length > 0 ? (
          <RadioGroup
            aria-label="Choose an offering"
            value={selected?.id}
            onValueChange={setSelectedId}
            className="mt-6 gap-2"
          >
            {offerings.map((o) => {
              const isSel = o.id === selected?.id;
              const priceText = o.price ? undefined : "Custom quote";
              return (
                <RadioGroupCard
                  key={o.id}
                  value={o.id}
                  aria-label={`${o.name}${o.price ? ` — ${PURCHASE_MODEL_LABEL[o.purchaseModel]}` : " — custom quote"}`}
                  className="items-start"
                >
                  <span className="flex w-full flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <span className="text-body font-semibold text-fg">{o.name}</span>
                    <PriceBlock
                      amount={o.price}
                      compareAt={o.compareAtPrice}
                      suffix={
                        o.billingInterval
                          ? `/ ${BILLING_INTERVAL_LABEL[o.billingInterval].toLowerCase()}`
                          : undefined
                      }
                      fallback={priceText}
                      size="sm"
                    />
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    <Badge
                      tone={
                        o.purchaseModel === "subscription"
                          ? "info"
                          : o.purchaseModel === "custom_quote"
                            ? "neutral"
                            : "accent"
                      }
                      size="sm"
                    >
                      {o.purchaseModel === "subscription" && o.billingInterval
                        ? `Subscription · ${BILLING_INTERVAL_LABEL[o.billingInterval].toLowerCase()}`
                        : PURCHASE_MODEL_LABEL[o.purchaseModel]}
                    </Badge>
                    <Badge tone="ghost" size="sm">
                      {DELIVERY_HINT[o.deliveryType]}
                    </Badge>
                    {o.trialDays ? (
                      <Badge tone="success" size="sm">
                        {o.trialDays}-day trial
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-caption text-fg-muted">
                    {o.licenseType ? `${o.licenseType} · ` : ""}Access: {o.accessPeriod}
                  </span>
                  {isSel && o.features.length > 0 ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-4 text-body-sm text-fg-muted">
                      {o.features.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  ) : null}
                </RadioGroupCard>
              );
            })}
          </RadioGroup>
        ) : null}

        {selected && !product.isComingSoon ? (
          <dl className="mt-5 space-y-1.5 border-t border-border pt-4 text-body-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Total</dt>
              <dd>
                <PriceBlock amount={selected.price} fallback="Quoted privately" size="md" />
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Delivered as</dt>
              <dd className="text-right text-fg">{DELIVERY_HINT[selected.deliveryType]}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-fg-muted">Updates</dt>
              <dd className="text-right text-fg">{UPDATE_POLICY_LABEL[selected.updatePolicy]}</dd>
            </div>
            {selected.price ? (
              <p className="text-caption text-fg-subtle">
                ≈ charged in INR · Prices exclude taxes where applicable
              </p>
            ) : null}
          </dl>
        ) : null}

        <div ref={ctaRef} aria-hidden={barVisible || undefined} className="mt-5 space-y-2">
          {primaryCta()}
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => setSheet("customise")}
          >
            Request customisation
          </Button>
        </div>
        <div className="mt-3 flex items-center justify-between text-caption text-fg-subtle">
          <span>{selected?.isRefundable ? "Refundable within 7 days" : "Non-refundable"}</span>
          {wishlisted !== undefined ? (
            <button
              type="button"
              aria-pressed={wishlisted}
              aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
              className="inline-flex items-center gap-1.5 rounded-sm text-body-sm text-fg-muted hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <HeartIcon
                aria-hidden
                className={cn("size-4", wishlisted && "fill-accent text-accent")}
              />
              Wishlist
            </button>
          ) : null}
        </div>
        {product.liveDemoUrl ? (
          <a
            href={product.liveDemoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-body-sm font-medium text-accent-text underline-offset-2 hover:underline"
          >
            Try live demo <ExternalLinkIcon aria-hidden className="size-4" />
            <span className="sr-only">(opens in new tab)</span>
          </a>
        ) : null}
      </div>

      <div
        aria-hidden={!barVisible || undefined}
        className={cn(
          "fixed inset-x-0 bottom-0 z-(--ck-z-sticky) border-t border-border bg-glass p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-glass transition-transform duration-(--ck-motion-duration-md) ease-emphasized md:hidden",
          barVisible ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-body-sm font-medium text-fg">
              {selected?.name ?? product.name}
            </p>
            <PriceBlock
              amount={selected?.price}
              fallback={product.isComingSoon ? "Coming soon" : "Custom quote"}
              size="sm"
            />
          </div>
          <div className="w-40">{primaryCta("h-11")}</div>
        </div>
      </div>

      <InquirySheet
        open={sheet !== null}
        onOpenChange={(o) => !o && setSheet(null)}
        serviceOptions={serviceOptions}
        source="product_cta"
        title={
          sheet === "quote"
            ? `Request a quote for ${product.name}`
            : `Customisation for ${product.name}`
        }
        description={
          sheet === "quote"
            ? "Tell us your requirements; we'll send a private quote."
            : "Tell us what you'd change; we reply by email within 2 working days."
        }
        defaults={{
          message:
            sheet === "quote"
              ? `Requirements for ${product.name} (${selected?.name ?? ""}): `
              : `Customisation for ${product.name}: `,
        }}
      />
    </>
  );
}
