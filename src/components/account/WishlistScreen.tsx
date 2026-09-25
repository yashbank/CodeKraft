"use client";

import { HeartIcon, XIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "@/lib/money";
import { EmptyState } from "./EmptyState";
import { ProductCover } from "./ProductCover";
import type { WishlistItem } from "./types";

/** SCR-ACC-07 — wishlist grid (3-up) with price/availability badges, View / Buy now / remove (undo toast). */
export function WishlistScreen({
  items: initial,
  links,
  loading = false,
}: {
  items: WishlistItem[];
  links: { dashboard: string };
  loading?: boolean;
}) {
  const [items, setItems] = React.useState(initial);
  const [sort, setSort] = React.useState<"recent" | "name" | "price">("recent");
  const sorted = [...items].sort((a, b) => {
    if (sort === "name") return a.productName.localeCompare(b.productName);
    if (sort === "price")
      return (
        (a.fromPrice?.amountMinor ?? Number.MAX_SAFE_INTEGER) -
        (b.fromPrice?.amountMinor ?? Number.MAX_SAFE_INTEGER)
      );
    return b.addedAt.localeCompare(a.addedAt);
  });

  function remove(item: WishlistItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    toast(`${item.productName} removed`, {
      action: { label: "Undo", onClick: () => setItems((prev) => [item, ...prev]) },
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1 text-fg">
          Wishlist <span className="text-fg-muted">({items.length})</span>
        </h1>
        <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
          <SelectTrigger size="sm" aria-label="Sort wishlist" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recently added</SelectItem>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="price">Price</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={HeartIcon}
          title="Your wishlist is empty"
          body="Browse products and tap the heart to save them."
          action={
            <Button asChild>
              <Link href="/products">Explore products</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((item) => (
            <li
              key={item.id}
              className="relative flex gap-3 rounded-lg border border-border bg-surface p-3 shadow-1 sm:flex-col sm:p-4"
            >
              <ProductCover name={item.productName} className="size-20 sm:hidden" />
              <ProductCover name={item.productName} ratio="wide" className="hidden sm:flex" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-overline font-semibold tracking-wider text-fg-muted uppercase">
                  {item.category}
                </p>
                <h2 className="text-body font-semibold text-fg">{item.productName}</h2>
                <div className="flex flex-wrap items-center gap-1.5">
                  {item.unavailable ? (
                    <Badge tone="ghost" size="sm">
                      No longer available
                    </Badge>
                  ) : item.comingSoon ? (
                    <Badge tone="warning" size="sm">
                      Coming soon
                    </Badge>
                  ) : item.customQuote ? (
                    <Badge tone="neutral" size="sm">
                      Custom quote
                    </Badge>
                  ) : item.fromPrice ? (
                    <span className="font-mono text-body font-semibold tnum text-fg">
                      From {format(item.fromPrice)}
                    </span>
                  ) : null}
                  {item.owned ? (
                    <Badge tone="success" size="sm">
                      You own this
                    </Badge>
                  ) : null}
                  {item.priceDropped ? (
                    <Badge tone="success" size="sm">
                      Price dropped
                    </Badge>
                  ) : null}
                  {item.newVersion ? (
                    <Badge tone="info" size="sm">
                      New version since saved
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {item.owned ? (
                    <Button size="sm" asChild>
                      <Link href={links.dashboard}>Open in dashboard</Link>
                    </Button>
                  ) : item.unavailable ? (
                    <Button size="sm" variant="secondary" onClick={() => remove(item)}>
                      Remove
                    </Button>
                  ) : (
                    <>
                      <Button size="sm" variant="secondary" asChild>
                        <Link href={item.productHref}>View product</Link>
                      </Button>
                      <Button
                        size="sm"
                        disabled={item.comingSoon || item.customQuote}
                        asChild={!(item.comingSoon || item.customQuote)}
                      >
                        {item.comingSoon || item.customQuote ? (
                          <span>{item.customQuote ? "Request a quote" : "Buy now"}</span>
                        ) : (
                          <Link href={`${item.productHref}?buy=1`}>Buy now</Link>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-2 right-2"
                aria-label={`Remove ${item.productName} from wishlist`}
                onClick={() => remove(item)}
              >
                <XIcon aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
