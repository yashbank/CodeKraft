import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  BLOG_POSTS,
  PRODUCTS,
  SERVICE_OPTIONS,
} from "@/app/dev/screens/_fixtures/site";
import { BlogPostPage } from "@/components/site/BlogPostPage";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) return {};

  return {
    title: `${post.title} — CodeKraft Blog`,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
    },
  };
}

export default async function BlogPostRoute({ params }: PageProps) {
  const { slug } = await params;
  const postIndex = BLOG_POSTS.findIndex((p) => p.slug === slug);

  if (postIndex === -1) {
    notFound();
  }

  const post = BLOG_POSTS[postIndex]!;
  const fallbackProduct = PRODUCTS[0]!;
  const product =
    PRODUCTS.find((p) => p.slug === post.product.slug) || fallbackProduct;

  const prevPost = postIndex > 0 ? BLOG_POSTS[postIndex - 1] : undefined;
  const nextPost = postIndex < BLOG_POSTS.length - 1 ? BLOG_POSTS[postIndex + 1] : undefined;

  const prev = prevPost ? { title: prevPost.title, href: `/blog/${prevPost.slug}` } : undefined;
  const next = nextPost ? { title: nextPost.title, href: `/blog/${nextPost.slug}` } : undefined;

  return (
    <BlogPostPage
      post={post}
      product={product}
      serviceOptions={SERVICE_OPTIONS}
      prev={prev}
      next={next}
    />
  );
}
