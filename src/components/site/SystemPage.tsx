"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/components/ui/_utils";

export type SystemPageVariant =
  "not_found" | "product_not_found" | "error" | "forbidden_admin" | "offline" | "maintenance";

export interface SystemPageProps {
  variant: SystemPageVariant;
  /** Sentry event id for `error.tsx`. */
  reference?: string;
  /** `error.tsx` reset / offline retry. */
  onRetry?: () => void;
  /** Product 404 when the signed-in customer still owns it. */
  ownedHref?: string;
  /** Admin-set maintenance message. */
  message?: string;
  /** Where "Go home" points (site `/`, account `/account`, admin `/dashboard`). */
  homeHref?: string;
  /** Let previews stack several variants without stealing focus from each other. */
  autoFocus?: boolean;
  className?: string;
}

/**
 * SCR-SITE-11 — shared system page body: decorative status glyph, h1 (focused on mount), one
 * sentence, one primary action, one secondary link. Rendered inside whichever shell is valid.
 * No contact details (D-808); the error reference is selectable text.
 */
export function SystemPage({
  variant,
  reference,
  onRetry,
  ownedHref,
  message,
  homeHref = "/",
  autoFocus = true,
  className,
}: SystemPageProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (autoFocus) heading.current?.focus();
  }, [autoFocus]);

  const v = VARIANTS[variant];
  return (
    <section
      aria-labelledby={`sys-${variant}`}
      className={cn("flex min-h-[60svh] items-center justify-center px-4 py-16", className)}
    >
      <div className="w-full max-w-[560px] space-y-6 text-center">
        <p
          aria-hidden
          className="ck-crossfade animate-in fade-in font-display text-display-xl text-fg-subtle/60 select-none"
        >
          {v.glyph}
        </p>
        <div className="space-y-2">
          <h1
            id={`sys-${variant}`}
            ref={heading}
            tabIndex={-1}
            className="font-display text-h1 outline-none"
          >
            {variant === "maintenance" ? "Back shortly" : v.title}
          </h1>
          <p className="text-body text-fg-muted">
            {variant === "maintenance" && message ? message : v.body}
          </p>
          {variant === "error" && reference ? (
            <p className="font-mono text-caption text-fg-subtle select-all">
              Reference: {reference}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          {variant === "error" || variant === "offline" ? (
            <Button type="button" size="lg" onClick={onRetry}>
              {variant === "offline" ? "Retry" : "Try again"}
            </Button>
          ) : variant === "product_not_found" ? (
            <Button asChild size="lg">
              <Link href="/products">Browse products</Link>
            </Button>
          ) : variant === "forbidden_admin" ? (
            <Button asChild size="lg">
              <Link href="/auth/logout">Sign out</Link>
            </Button>
          ) : (
            <Button asChild size="lg">
              <Link href={homeHref}>Go home</Link>
            </Button>
          )}
          {variant === "not_found" ? (
            <Button asChild variant="secondary" size="lg">
              <Link href="/products">Browse products</Link>
            </Button>
          ) : variant === "error" ? (
            <Button asChild variant="secondary" size="lg">
              <Link href={homeHref}>Go home</Link>
            </Button>
          ) : variant === "forbidden_admin" ? (
            <Button asChild variant="secondary" size="lg">
              <Link href="/">Go to the site</Link>
            </Button>
          ) : variant === "product_not_found" && ownedHref ? (
            <Button asChild variant="secondary" size="lg">
              <Link href={ownedHref}>It&rsquo;s still in your purchases — open</Link>
            </Button>
          ) : null}
        </div>
        {variant === "not_found" ? (
          <form
            action="/products"
            method="get"
            role="search"
            className="mx-auto flex max-w-sm gap-2 pt-2"
          >
            <Label htmlFor="sys-search" className="sr-only">
              Search products
            </Label>
            <Input id="sys-search" name="q" type="search" placeholder="Search products" />
            <Button type="submit" variant="secondary" aria-label="Search">
              <SearchIcon aria-hidden />
            </Button>
          </form>
        ) : null}
        <p className="text-caption text-fg-subtle">Signed in? Open a query from your dashboard.</p>
      </div>
    </section>
  );
}

const VARIANTS: Readonly<
  Record<SystemPageVariant, { glyph: ReactNode; title: string; body: string }>
> = {
  not_found: {
    glyph: "404",
    title: "We couldn't find that page",
    body: "The link may be old, or the page may have moved.",
  },
  product_not_found: {
    glyph: "404",
    title: "This product is no longer available",
    body: "It has been retired from the catalogue.",
  },
  error: {
    glyph: "500",
    title: "Something went wrong",
    body: "We've logged it. You can try again or head home.",
  },
  forbidden_admin: {
    glyph: "403",
    title: "You don't have access to the admin app",
    body: "This account is not an admin.",
  },
  offline: { glyph: "⌁", title: "You're offline", body: "Check your connection and try again." },
  maintenance: {
    glyph: "⏳",
    title: "Back shortly",
    body: "We're doing some planned maintenance.",
  },
};
