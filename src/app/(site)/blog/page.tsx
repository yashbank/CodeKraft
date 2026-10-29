import type { Metadata } from "next";

import { pageMetadata } from "@/lib/seo";

import { BlogIndexPage } from "@/components/site/BlogIndexPage";
import { toBlogTeaser } from "@/lib/blog-view";
import { anonymousContext } from "@/lib/authz/context";
import { listBlogPostsQuery } from "@/modules/blog/queries";

// ISR (API-CAT-33: 60 s). Admin blog saves call revalidatePath("/", "layout").
export const revalidate = 60;

export const metadata: Metadata = pageMetadata({
  path: "/blog",
  title: "Blog",
  description: "Deep dives into the architecture, design, and software we build.",
});

export default async function BlogPage() {
  const result = await listBlogPostsQuery({ limit: 100 }, anonymousContext());
  const posts = result.ok ? result.data.items.map(toBlogTeaser) : [];
  return <BlogIndexPage posts={posts} />;
}
