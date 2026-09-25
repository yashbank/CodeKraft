import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { formatDate, slugify } from "./_format";
import { Container } from "./Container";
import { CtaBand } from "./CtaBand";
import { InquiryTrigger } from "./InquiryTrigger";
import { MediaPlaceholder } from "./MediaPlaceholder";
import { PrevNextNav, type PrevNextItem } from "./PrevNextNav";
import { ProductCardCompact } from "./ProductCardCompact";
import { RichText } from "./RichText";
import { TableOfContents, type TocItem } from "./TableOfContents";
import type { BlogPost, ProductSummary, ServiceOption } from "./types";

export interface BlogPostPageProps {
  post: BlogPost;
  product: ProductSummary;
  serviceOptions: ServiceOption[];
  prev?: PrevNextItem;
  next?: PrevNextItem;
  wishlisted?: boolean;
}

/** Adds ids to `<h2>` headings (server-side) and returns the TOC. */
function withHeadingIds(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const out = html.replace(/<h2>([^<]+)<\/h2>/g, (_m, text: string) => {
    const id = slugify(text);
    toc.push({ id, label: text });
    return `<h2 id="${id}">${text}</h2>`;
  });
  return { html: out, toc };
}

/**
 * SCR-SITE-08 — breadcrumb, header (product chip, h1, lede, date, reading time, author
 * "CodeKraft"), 21:9 cover, 720 px body from sanitised HTML, sticky rail with compact product
 * card + "Article contents" TOC (h2s), customisation band, prev/next. Phone: product card inline
 * under the header and again at the end, TOC omitted.
 */
export function BlogPostPage({
  post,
  product,
  serviceOptions,
  prev,
  next,
  wishlisted,
}: BlogPostPageProps) {
  const { html, toc } = withHeadingIds(post.bodyHtml);
  const productCard = <ProductCardCompact product={product} wishlisted={wishlisted} />;
  return (
    <article>
      <Container className="pt-6 lg:pt-8">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/blog">Blog</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{post.title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <header className="mt-8 max-w-3xl space-y-4">
          <Badge tone="accent">{post.product.name}</Badge>
          <h1 className="font-display text-display-lg text-balance">{post.title}</h1>
          <p className="text-body-lg text-fg-muted">{post.excerpt}</p>
          <p className="text-body-sm text-fg-subtle">
            By CodeKraft · <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time> ·{" "}
            {post.readingMinutes} min read
          </p>
        </header>
        <MediaPlaceholder
          alt={post.coverAlt}
          tone={post.coverTone}
          ratio="21/9"
          className="mt-10 rounded-2xl"
        />
      </Container>

      <Container className="mt-10 lg:mt-16 lg:grid lg:grid-cols-[minmax(0,720px)_300px] lg:justify-between lg:gap-12 tv:grid-cols-[minmax(0,840px)_300px]">
        <div className="lg:hidden">{productCard}</div>
        <div className="mt-10 lg:mt-0">
          <RichText html={html} />
          <div className="mt-12 lg:hidden">{productCard}</div>
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            {productCard}
            {toc.length > 0 ? (
              <div>
                <p className="mb-3 text-overline tracking-wider text-fg-muted uppercase">
                  Article contents
                </p>
                <TableOfContents items={toc} label="Article contents" />
              </div>
            ) : null}
          </div>
        </aside>
      </Container>

      <CtaBand
        title={`Want ${product.name} adapted to your workflow?`}
        body="Tell us what you'd change and we'll scope it."
        actions={
          <InquiryTrigger
            size="lg"
            sheet={{
              serviceOptions,
              source: "product_cta",
              title: `Customisation for ${product.name}`,
              defaults: { message: `Customisation for ${product.name}: ` },
            }}
          >
            Request customisation
          </InquiryTrigger>
        }
      />
      {prev || next ? (
        <Container className="pb-16">
          <PrevNextNav prev={prev} next={next} label="Adjacent articles" />
        </Container>
      ) : null}
    </article>
  );
}
