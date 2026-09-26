import type { Metadata } from "next";

import { BLOG_POSTS } from "@/app/dev/screens/_fixtures/site";
import { BlogIndexPage } from "@/components/site/BlogIndexPage";

export const metadata: Metadata = {
  title: "Blog — CodeKraft",
  description: "Deep dives into the architecture, design, and software we build at CodeKraft.",
};

export default function BlogPage() {
  return <BlogIndexPage posts={BLOG_POSTS} />;
}
