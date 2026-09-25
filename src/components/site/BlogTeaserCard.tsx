import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/components/ui/_utils";

import { formatDate } from "./_format";
import { MediaPlaceholder } from "./MediaPlaceholder";
import type { BlogTeaser } from "./types";

/**
 * Blog teaser — docs/08 §6.3 "Blog card": 16:9 cover, product overline, h4, excerpt clamp-3,
 * reading time, date. `featured` renders the wide 21:9 variant used at the top of /blog.
 * `showProductLink` adds the secondary "View product →" link (index page).
 */
export function BlogTeaserCard({
  post,
  featured = false,
  showProductLink = false,
  headingLevel: Heading = "h3",
  className,
}: {
  post: BlogTeaser;
  featured?: boolean;
  showProductLink?: boolean;
  headingLevel?: "h2" | "h3";
  className?: string;
}) {
  const href = `/blog/${post.slug}`;
  return (
    <Card
      data-interactive="true"
      className={cn(
        "group relative gap-0 overflow-hidden py-0",
        featured && "lg:grid lg:grid-cols-5",
        className,
      )}
    >
      <div className={cn("p-3 pb-0", featured && "lg:col-span-3 lg:pb-3")}>
        <MediaPlaceholder
          alt={post.coverAlt}
          tone={post.coverTone}
          ratio={featured ? "21/9" : "16/9"}
        />
      </div>
      <div
        className={cn(
          "flex flex-1 flex-col gap-3 p-5",
          featured && "lg:col-span-2 lg:justify-center lg:p-8",
        )}
      >
        <Badge tone="accent" size="sm" className="w-fit">
          {post.product.name}
        </Badge>
        <Heading className={featured ? "text-h2" : "text-h4"}>
          <Link
            href={href}
            className="rounded-xs after:absolute after:inset-0 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {post.title}
          </Link>
        </Heading>
        <p className={cn("text-body-sm text-fg-muted", featured ? "line-clamp-4" : "line-clamp-3")}>
          {post.excerpt}
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2 text-caption text-fg-subtle">
          <span>
            <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time> ·{" "}
            {post.readingMinutes} min read
          </span>
          {showProductLink ? (
            <Link
              href={`/products/${post.product.slug}`}
              className="relative z-10 text-body-sm font-medium text-accent-text underline-offset-2 hover:underline"
            >
              View product →
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

export function BlogTeaserCardSkeleton({ featured = false }: { featured?: boolean }) {
  return (
    <Card
      aria-hidden
      className={cn("gap-0 overflow-hidden py-0", featured && "lg:grid lg:grid-cols-5")}
    >
      <div className={cn("p-3 pb-0", featured && "lg:col-span-3 lg:pb-3")}>
        <Skeleton className={featured ? "aspect-[21/9] w-full" : "aspect-video w-full"} />
      </div>
      <div className={cn("space-y-3 p-5", featured && "lg:col-span-2 lg:p-8")}>
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </Card>
  );
}
