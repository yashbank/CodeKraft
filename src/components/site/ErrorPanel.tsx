"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { SiteLogo } from "@/components/brand/site-brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ErrorPanelLink {
  href: string;
  label: string;
}

/**
 * Branded 404 / 500 body (P14-12b): site logo, plain-language message, a search box and helpful
 * links. Never prints error details - only the opaque `digest` reference so support can find the log.
 */
export function ErrorPanel({
  code,
  title,
  body,
  links,
  searchAction,
  digest,
  onRetry,
  children,
}: {
  code: "404" | "500";
  title: string;
  body: string;
  links: ErrorPanelLink[];
  /** Form action for the search box (GET `?q=`); omit to hide it. */
  searchAction?: string;
  digest?: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6 text-center">
        <SiteLogo className="mx-auto h-8" />
        <p className="text-overline text-fg-muted uppercase">{code}</p>
        <h1 className="text-h2">{title}</h1>
        <p className="text-body text-fg-muted">{body}</p>
        {digest ? <p className="text-body-sm text-fg-muted">Reference: {digest}</p> : null}
        {searchAction ? (
          <form action={searchAction} className="flex gap-2">
            <Input
              name="q"
              type="search"
              placeholder="Search products"
              aria-label="Search products"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {onRetry ? <Button onClick={onRetry}>Try again</Button> : null}
          {links.map((l, i) => (
            <Button key={l.href} variant={i === 0 && !onRetry ? "default" : "secondary"} asChild>
              <Link href={l.href}>{l.label}</Link>
            </Button>
          ))}
        </div>
        {children}
      </div>
    </div>
  );
}
