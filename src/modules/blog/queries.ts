"use server";

/**
 * Blog read-only queries (API-CAT-33, API-CAT-34, PHASE-03 P3.10).
 * All public queries use definePublicAction (SA-07).
 */
import { definePublicAction } from "@/lib/actions/envelope";
import { getBlogBySlugSchema, listBlogPostsSchema, listBlogTeasersSchema } from "./contracts";
import { blogService } from "./service";

export const listBlogPostsQuery = definePublicAction({
  name: "API-CAT-33 listBlogPosts",
  input: listBlogPostsSchema,
  handler: (input, ctx) => blogService.listBlogPosts(ctx, input),
});

export const getBlogBySlugQuery = definePublicAction({
  name: "API-CAT-33 getBlogBySlug",
  input: getBlogBySlugSchema,
  handler: (input, ctx) => blogService.getBlogBySlug(ctx, input),
});

export const listBlogTeasersQuery = definePublicAction({
  name: "API-CAT-34 listBlogTeasers",
  input: listBlogTeasersSchema,
  handler: (input, ctx) => blogService.listBlogTeasers(ctx, input),
});
