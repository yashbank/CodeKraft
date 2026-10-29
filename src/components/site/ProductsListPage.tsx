"use client";

import { LayoutGridIcon, ListIcon, SearchIcon, SlidersHorizontalIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { toggleWishlist } from "@/modules/catalog/site-mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/_utils";

import { DELIVERY_LABEL, PURCHASE_MODEL_LABEL } from "./_format";
import { Container } from "./Container";
import { EmptyState } from "./EmptyState";
import { ProductCard, ProductCardSkeleton } from "./ProductCard";
import {
  countActiveFilters,
  EMPTY_FILTERS,
  ProductFilters,
  type CategoryNode,
  type ProductFilterState,
} from "./ProductFilters";
import { currencySymbol } from "@/lib/currency-prefs";
import type { DeliveryType, ProductSummary, PurchaseModel } from "./types";

export type ProductSort = "newest" | "price_asc" | "price_desc" | "popular" | "featured";

/** URL query params this screen reads/writes, so filters are shareable and survive back/forward. */
function filtersFromParams(params: URLSearchParams): ProductFilterState {
  const list = (key: string) => params.get(key)?.split(",").filter(Boolean) ?? [];
  const priceMin = params.get("priceMin");
  const priceMax = params.get("priceMax");
  return {
    categories: list("category"),
    models: list("model") as PurchaseModel[],
    deliveries: list("delivery") as DeliveryType[],
    tech: list("tech"),
    industries: list("industry"),
    audiences: list("audience"),
    priceMin: priceMin ? Number(priceMin) : undefined,
    priceMax: priceMax ? Number(priceMax) : undefined,
  };
}

type ParamPatch = Record<string, string | string[] | number | undefined>;

function withParams(current: URLSearchParams, patch: ParamPatch): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(patch)) {
    const isEmpty =
      value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
    if (isEmpty) next.delete(key);
    else next.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return next;
}

const SORT_LABEL: Readonly<Record<ProductSort, string>> = {
  newest: "Newest",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
  popular: "Most popular",
  featured: "Featured",
};

export interface ProductsListPageProps {
  products: ProductSummary[];
  categories: CategoryNode[];
  /** `site_settings.products_intro` */
  intro?: string;
  pageSize?: number;
  /** Route `loading.tsx` look: skeleton filter panel + 6 skeleton cards, toolbar stays interactive. */
  loading?: boolean;
  /** Search backend outage: alert + unfiltered list (SCR-SITE-03 error state). */
  searchUnavailable?: boolean;
  /** Preview hooks so states can be deep-linked. */
  initialQuery?: string;
  initialFilters?: Partial<ProductFilterState>;
  /** Signed-in customer: shows the wishlist heart as a real toggle instead of a login link. */
  signedIn?: boolean;
  /** This customer's currently wishlisted product ids. */
  wishlistedIds?: string[];
}

function matches(p: ProductSummary, q: string, f: ProductFilterState): boolean {
  if (q) {
    const hay =
      `${p.name} ${p.shortDescription} ${p.tags.join(" ")} ${p.techStack.join(" ")}`.toLowerCase();
    if (!hay.includes(q.toLowerCase())) return false;
  }
  if (f.categories.length > 0) {
    const own = [p.category.slug, p.category.parent?.slug].filter(Boolean) as string[];
    if (!own.some((c) => f.categories.includes(c))) return false;
  }
  if (f.models.length > 0 && !p.purchaseModels.some((m) => f.models.includes(m))) return false;
  if (f.deliveries.length > 0 && !p.deliveryTypes.some((d) => f.deliveries.includes(d)))
    return false;
  if (f.tech.length > 0 && !p.techStack.some((t) => f.tech.includes(t))) return false;
  if (f.industries.length > 0 && !p.industries.some((t) => f.industries.includes(t))) return false;
  if (f.audiences.length > 0 && !p.audiences.some((t) => f.audiences.includes(t))) return false;
  if (f.priceMin !== undefined || f.priceMax !== undefined) {
    if (!p.fromPrice) return false;
    const rupees = Math.floor(p.fromPrice.amountMinor / 100);
    if (f.priceMin !== undefined && rupees < f.priceMin) return false;
    if (f.priceMax !== undefined && rupees > f.priceMax) return false;
  }
  return true;
}

function sortProducts(list: ProductSummary[], sort: ProductSort): ProductSummary[] {
  const price = (p: ProductSummary) => p.fromPrice?.amountMinor ?? Number.MAX_SAFE_INTEGER;
  return [...list].sort((a, b) => {
    switch (sort) {
      case "price_asc":
        return price(a) - price(b);
      case "price_desc":
        return (b.fromPrice?.amountMinor ?? -1) - (a.fromPrice?.amountMinor ?? -1);
      case "popular":
        return b.popularity - a.popularity;
      case "featured":
        return (
          Number(b.isFeatured) - Number(a.isFeatured) || b.publishedAt.localeCompare(a.publishedAt)
        );
      default:
        return b.publishedAt.localeCompare(a.publishedAt);
    }
  });
}

/**
 * SCR-SITE-03 — search, sidebar filters (Sheet below lg with sticky "Show N products"), active
 * filter chips, sort, grid/list toggle, 3-up grid (4-up at 2xl), pagination, tax footnote (BR-08).
 * Client-side over the passed list; P7 moves query/filters/sort/page to the URL and SSR.
 */
export function ProductsListPage({
  products,
  categories,
  intro,
  pageSize = 25,
  loading = false,
  searchUnavailable = false,
  initialQuery = "",
  initialFilters,
  signedIn = false,
  wishlistedIds = [],
}: ProductsListPageProps) {
  const symbol = currencySymbol(products.find((p) => p.fromPrice)?.fromPrice?.currency ?? "INR");
  const [wishlisted, setWishlisted] = useState<Set<string>>(() => new Set(wishlistedIds));

  async function toggleWishlistFor(productId: string) {
    const isOn = wishlisted.has(productId);
    setWishlisted((prev) => {
      const next = new Set(prev);
      if (isOn) next.delete(productId);
      else next.add(productId);
      return next;
    });
    const result = await toggleWishlist({ productId, on: !isOn });
    if (!result.ok) {
      setWishlisted((prev) => {
        const next = new Set(prev);
        if (isOn) next.add(productId);
        else next.delete(productId);
        return next;
      });
      toast.error(result.error.message);
    }
  }

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (patch: ParamPatch, opts?: { push?: boolean }) => {
      const next = withParams(searchParams, patch);
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      if (opts?.push) router.push(url, { scroll: false });
      else router.replace(url, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  const query = searchParams.get("q") ?? initialQuery;
  const sort = (searchParams.get("sort") as ProductSort | null) ?? "newest";
  const view = (searchParams.get("view") as "grid" | "list" | null) ?? "grid";
  const page = Number(searchParams.get("page") ?? "1") || 1;
  const filters = useMemo(() => {
    const filterKeys = [
      "category",
      "model",
      "delivery",
      "tech",
      "industry",
      "audience",
      "priceMin",
      "priceMax",
    ];
    const hasUrlFilters = filterKeys.some((k) => searchParams.has(k));
    return hasUrlFilters
      ? filtersFromParams(searchParams)
      : { ...EMPTY_FILTERS, ...initialFilters };
  }, [searchParams, initialFilters]);
  const [draft, setDraft] = useState<ProductFilterState>(filters);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const updateQuery = (v: string) => setParams({ q: v || undefined, page: undefined });
  const goToPage = (n: number) => setParams({ page: n === 1 ? undefined : n }, { push: true });
  const changeSort = (v: ProductSort) =>
    setParams({ sort: v === "newest" ? undefined : v, page: undefined }, { push: true });
  const changeView = (v: "grid" | "list") =>
    setParams({ view: v === "grid" ? undefined : v }, { push: true });

  const facets = useMemo(
    () => ({
      tech: [...new Set(products.flatMap((p) => p.techStack))].sort(),
      industries: [...new Set(products.flatMap((p) => p.industries))].sort(),
      audiences: [...new Set(products.flatMap((p) => p.audiences))].sort(),
    }),
    [products],
  );

  const effectiveFilters = searchUnavailable ? EMPTY_FILTERS : filters;
  const effectiveQuery = searchUnavailable ? "" : query;
  const results = useMemo(
    () =>
      sortProducts(
        products.filter((p) => matches(p, effectiveQuery, effectiveFilters)),
        sort,
      ),
    [products, effectiveQuery, effectiveFilters, sort],
  );
  const pages = Math.max(1, Math.ceil(results.length / pageSize));
  const current = Math.min(page, pages);
  const visible = results.slice((current - 1) * pageSize, current * pageSize);
  const draftCount = products.filter((p) => matches(p, query, draft)).length;
  const activeCount = countActiveFilters(filters);

  const applyFilters = (next: ProductFilterState) => {
    setDraft(next);
    setParams(
      {
        category: next.categories,
        model: next.models,
        delivery: next.deliveries,
        tech: next.tech,
        industry: next.industries,
        audience: next.audiences,
        priceMin: next.priceMin,
        priceMax: next.priceMax,
        page: undefined,
      },
      { push: true },
    );
  };

  const chips: { key: string; label: string; remove: () => void }[] = [
    ...filters.categories.map((c) => ({
      key: `cat-${c}`,
      label: categories.flatMap((n) => [n, ...n.children]).find((n) => n.slug === c)?.name ?? c,
      remove: () =>
        applyFilters({ ...filters, categories: filters.categories.filter((x) => x !== c) }),
    })),
    ...filters.models.map((m) => ({
      key: `model-${m}`,
      label: PURCHASE_MODEL_LABEL[m],
      remove: () => applyFilters({ ...filters, models: filters.models.filter((x) => x !== m) }),
    })),
    ...filters.deliveries.map((d) => ({
      key: `del-${d}`,
      label: DELIVERY_LABEL[d],
      remove: () =>
        applyFilters({ ...filters, deliveries: filters.deliveries.filter((x) => x !== d) }),
    })),
    ...filters.tech.map((t) => ({
      key: `tech-${t}`,
      label: t,
      remove: () => applyFilters({ ...filters, tech: filters.tech.filter((x) => x !== t) }),
    })),
    ...filters.industries.map((t) => ({
      key: `ind-${t}`,
      label: t,
      remove: () =>
        applyFilters({ ...filters, industries: filters.industries.filter((x) => x !== t) }),
    })),
    ...filters.audiences.map((t) => ({
      key: `aud-${t}`,
      label: t,
      remove: () =>
        applyFilters({ ...filters, audiences: filters.audiences.filter((x) => x !== t) }),
    })),
    ...(filters.priceMin !== undefined || filters.priceMax !== undefined
      ? [
          {
            key: "price",
            label: `${symbol}${String(filters.priceMin ?? 0)} – ${filters.priceMax !== undefined ? `${symbol}${String(filters.priceMax)}` : "any"}`,
            remove: () => applyFilters({ ...filters, priceMin: undefined, priceMax: undefined }),
          },
        ]
      : []),
  ];

  const filterPanelProps = {
    categories,
    techOptions: facets.tech,
    industryOptions: facets.industries,
    audienceOptions: facets.audiences,
    currencySymbol: symbol,
  };

  return (
    <Container className="py-10 lg:py-14">
      <div className="max-w-3xl space-y-4">
        <h1 className="font-display text-display-lg">Products</h1>
        <p className="text-body-lg text-fg-muted">
          {intro ??
            "Ready-made software from our studio — subscriptions, licenses and downloads with honest pricing."}
        </p>
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
          }}
          className="relative"
        >
          <Label htmlFor="product-search" className="sr-only">
            Search products
          </Label>
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
          />
          <Input
            id="product-search"
            type="search"
            placeholder="Search products"
            value={query}
            onChange={(e) => {
              updateQuery(e.target.value);
            }}
            className="pr-10 pl-9"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => updateQuery("")}
              className="absolute top-1/2 right-2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-sm text-fg-muted hover:bg-accent-soft hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <XIcon aria-hidden className="size-4" />
            </button>
          ) : null}
        </form>
        <p aria-live="polite" className="text-body-sm text-fg-muted">
          {loading
            ? "Loading products…"
            : `${String(results.length)} ${results.length === 1 ? "product" : "products"}`}
        </p>
      </div>

      {searchUnavailable ? (
        <div
          role="alert"
          className="mt-6 rounded-md border-l-4 border-warning bg-warning-soft px-4 py-3 text-body-sm text-warning"
        >
          Search is temporarily unavailable — showing all products.
        </div>
      ) : null}

      <div className="mt-8 lg:grid lg:grid-cols-[280px_1fr] lg:gap-10 tv:grid-cols-[320px_1fr]">
        <div className="hidden lg:block">
          {loading ? (
            <FilterSkeleton />
          ) : (
            <div className="sticky top-24">
              <ProductFilters value={filters} onChange={applyFilters} {...filterPanelProps} />
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <Sheet
              open={drawerOpen}
              onOpenChange={(o) => {
                setDrawerOpen(o);
                if (o) setDraft(filters);
              }}
            >
              <SheetTrigger asChild>
                <Button type="button" variant="secondary" className="lg:hidden">
                  <SlidersHorizontalIcon aria-hidden />
                  Filters{activeCount > 0 ? ` (${String(activeCount)})` : ""}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="flex h-[92dvh] flex-col gap-0 p-0">
                <SheetHeader className="border-b border-border">
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>Changes apply when you tap Show products.</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <ProductFilters value={draft} onChange={setDraft} {...filterPanelProps} />
                </div>
                <div className="border-t border-border bg-elevated p-4">
                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    onClick={() => {
                      applyFilters(draft);
                      setDrawerOpen(false);
                    }}
                  >
                    Show {draftCount} {draftCount === 1 ? "product" : "products"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <div className="ml-auto flex items-center gap-2">
              <Label htmlFor="product-sort" className="sr-only">
                Sort by
              </Label>
              <Select value={sort} onValueChange={(v) => changeSort(v as ProductSort)}>
                <SelectTrigger id="product-sort" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABEL) as ProductSort[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {SORT_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div
                role="group"
                aria-label="View"
                className="hidden rounded-md border border-border bg-surface p-[3px] sm:inline-flex"
              >
                <ViewButton
                  active={view === "grid"}
                  label="Grid view"
                  onClick={() => changeView("grid")}
                >
                  <LayoutGridIcon aria-hidden className="size-4" />
                </ViewButton>
                <ViewButton
                  active={view === "list"}
                  label="List view"
                  onClick={() => changeView("list")}
                >
                  <ListIcon aria-hidden className="size-4" />
                </ViewButton>
              </div>
            </div>
          </div>

          {chips.length > 0 ? (
            <ul aria-label="Active filters" className="mt-4 flex flex-wrap gap-2">
              {chips.map((c) => (
                <li key={c.key}>
                  <button
                    type="button"
                    onClick={c.remove}
                    aria-label={`Remove filter: ${c.label}`}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface pr-2 pl-3 text-body-sm text-fg transition-colors hover:border-accent hover:text-accent-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    {c.label}
                    <XIcon aria-hidden className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-6">
            {loading ? (
              <ul className={gridClass("grid")}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <li key={i}>
                    <ProductCardSkeleton />
                  </li>
                ))}
              </ul>
            ) : products.length === 0 ? (
              <EmptyState
                icon={SearchIcon}
                title="Products coming soon"
                body="We're preparing the catalogue. Meanwhile, tell us what you need built."
                actions={
                  <Button asChild>
                    <Link href="/contact">Start a project</Link>
                  </Button>
                }
              />
            ) : results.length === 0 ? (
              <EmptyState
                icon={SearchIcon}
                title={query ? `No products match “${query}”` : "No products match these filters"}
                body="Try fewer filters or browse all."
                actions={
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setDraft(EMPTY_FILTERS);
                        setParams(
                          {
                            q: undefined,
                            category: undefined,
                            model: undefined,
                            delivery: undefined,
                            tech: undefined,
                            industry: undefined,
                            audience: undefined,
                            priceMin: undefined,
                            priceMax: undefined,
                            page: undefined,
                          },
                          { push: true },
                        );
                      }}
                    >
                      Clear filters
                    </Button>
                    <Button asChild variant="ghost">
                      <Link href="/contact">Start a project</Link>
                    </Button>
                  </>
                }
              />
            ) : (
              <ul className={cn("ck-crossfade", gridClass(view))}>
                {visible.map((p) => (
                  <li key={p.id}>
                    <ProductCard
                      product={p}
                      layout={view === "list" ? "row" : "grid"}
                      className="h-full"
                      wishlisted={wishlisted.has(p.id)}
                      onWishlistToggle={signedIn ? () => toggleWishlistFor(p.id) : undefined}
                      wishlistHref={
                        signedIn ? undefined : `/auth/login?next=${encodeURIComponent("/products")}`
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {!loading && results.length > 0 ? (
            <>
              {pages > 1 ? (
                <Pagination aria-label="Pagination" className="mt-10">
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        aria-disabled={current === 1}
                        className={cn(current === 1 && "pointer-events-none opacity-50")}
                        onClick={(e) => {
                          e.preventDefault();
                          goToPage(Math.max(1, current - 1));
                        }}
                      />
                    </PaginationItem>
                    {Array.from({ length: pages }).map((_, i) => (
                      <PaginationItem key={i}>
                        <PaginationLink
                          href="#"
                          isActive={current === i + 1}
                          onClick={(e) => {
                            e.preventDefault();
                            goToPage(i + 1);
                          }}
                        >
                          {i + 1}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        href="#"
                        aria-disabled={current === pages}
                        className={cn(current === pages && "pointer-events-none opacity-50")}
                        onClick={(e) => {
                          e.preventDefault();
                          goToPage(Math.min(pages, current + 1));
                        }}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              ) : null}
              <p className="mt-8 text-caption text-fg-subtle">
                Prices exclude taxes where applicable.
              </p>
            </>
          ) : null}
        </div>
      </div>
    </Container>
  );
}

function gridClass(view: "grid" | "list"): string {
  return view === "list"
    ? "flex flex-col gap-4"
    : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 tv:gap-6";
}

function ViewButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active ? "bg-elevated text-fg shadow-1" : "text-fg-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function FilterSkeleton() {
  return (
    <div aria-hidden className="space-y-4">
      <Skeleton className="h-6 w-24" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2 border-b border-border pb-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}
