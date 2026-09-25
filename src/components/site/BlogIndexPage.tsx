"use client";

import { NewspaperIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/components/ui/_utils";

import { BlogTeaserCard, BlogTeaserCardSkeleton } from "./BlogTeaserCard";
import { Container } from "./Container";
import { EmptyState } from "./EmptyState";
import type { BlogTeaser } from "./types";

export interface BlogIndexPageProps {
  posts: BlogTeaser[];
  pageSize?: number;
  loading?: boolean;
}

/**
 * SCR-SITE-07 — h1 + intro, product-category chips (client-side here; `?category=` in P7),
 * featured latest article (21:9), 3-up grid (4-up at tv) with "View product →", pagination 12/page.
 */
export function BlogIndexPage({ posts, pageSize = 12, loading = false }: BlogIndexPageProps) {
  const [category, setCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    posts.forEach((p) => map.set(p.product.category.slug, p.product.category.name));
    return [...map.entries()].map(([slug, name]) => ({ slug, name }));
  }, [posts]);
  const sorted = posts
    .filter((p) => (category ? p.product.category.slug === category : true))
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  const [featured, ...rest] = sorted;
  const pages = Math.max(1, Math.ceil(rest.length / pageSize));
  const current = Math.min(page, pages);
  const visible = rest.slice((current - 1) * pageSize, current * pageSize);

  return (
    <Container className="py-10 lg:py-14">
      <div className="max-w-3xl space-y-3">
        <h1 className="font-display text-display-lg">Blog</h1>
        <p className="text-body-lg text-fg-muted">Deep dives into the products we build.</p>
      </div>
      {categories.length > 1 ? (
        <div
          role="group"
          aria-label="Filter by product category"
          className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:flex-wrap md:px-0"
        >
          <Chip
            active={category === null}
            onClick={() => {
              setCategory(null);
              setPage(1);
            }}
          >
            All
          </Chip>
          {categories.map((c) => (
            <Chip
              key={c.slug}
              active={category === c.slug}
              onClick={() => {
                setCategory(category === c.slug ? null : c.slug);
                setPage(1);
              }}
            >
              {c.name}
            </Chip>
          ))}
        </div>
      ) : null}

      <div className="mt-8 space-y-8">
        {loading ? (
          <>
            <BlogTeaserCardSkeleton featured />
            <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 tv:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i}>
                  <BlogTeaserCardSkeleton />
                </li>
              ))}
            </ul>
          </>
        ) : !featured ? (
          <EmptyState
            icon={NewspaperIcon}
            title="No articles yet"
            body="Every product gets its own deep dive. Browse the catalogue meanwhile."
            actions={
              <Button asChild>
                <Link href="/products">Browse products</Link>
              </Button>
            }
          />
        ) : (
          <>
            <BlogTeaserCard post={featured} featured showProductLink headingLevel="h2" />
            {visible.length > 0 ? (
              <ul className="ck-crossfade grid gap-4 md:grid-cols-2 lg:grid-cols-3 tv:grid-cols-4">
                {visible.map((p) => (
                  <li key={p.slug}>
                    <BlogTeaserCard post={p} showProductLink className="h-full" />
                  </li>
                ))}
              </ul>
            ) : null}
            {pages > 1 ? (
              <Pagination aria-label="Pagination">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      aria-disabled={current === 1}
                      className={cn(current === 1 && "pointer-events-none opacity-50")}
                      onClick={(e) => {
                        e.preventDefault();
                        setPage(Math.max(1, current - 1));
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
                          setPage(i + 1);
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
                        setPage(Math.min(pages, current + 1));
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            ) : null}
          </>
        )}
      </div>
    </Container>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 rounded-full border px-3.5 text-body-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        active
          ? "border-accent bg-accent-soft text-accent-text"
          : "border-border bg-surface text-fg-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}
