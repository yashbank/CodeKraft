import { BlogPostPage } from "@/components/site/BlogPostPage";
import type { BlogPost, ProductSummary } from "@/components/site/types";

import { BLOG_POSTS, PRODUCTS, SERVICE_OPTIONS } from "../../_fixtures/site";
import { readState, SitePreview, type SearchParams } from "../_shared";

export const metadata = { title: "SCR-SITE-08 Blog post" };

const STATES = [
  { id: "default", label: "Visitor" },
  { id: "customer", label: "Customer (wishlisted)" },
];

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const state = await readState(searchParams);
  const [post, next] = BLOG_POSTS as [BlogPost, BlogPost, BlogPost];
  const product = PRODUCTS.find((p) => p.slug === post.product.slug) as ProductSummary;
  return (
    <SitePreview
      href="/dev/screens/site/blog-post"
      states={STATES}
      current={state}
      currentPath="/blog"
    >
      <BlogPostPage
        key={state}
        post={post}
        product={product}
        serviceOptions={SERVICE_OPTIONS}
        wishlisted={state === "customer" ? true : undefined}
        next={{ href: `/blog/${next.slug}`, title: next.title, eyebrow: "Next article" }}
      />
    </SitePreview>
  );
}
