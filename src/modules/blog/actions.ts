"use server";

/**
 * Blog Server Actions (API-CAT-10, PHASE-03 P3.10).
 * All actions are wrapped in defineAction (SA-07).
 */
import { defineAction } from "@/lib/actions/envelope";
import { blogPublishSchema, upsertProductBlogSchema } from "./contracts";
import { blogService } from "./service";

export const upsertProductBlogAction = defineAction({
  name: "API-CAT-10 upsertProductBlog",
  input: upsertProductBlogSchema,
  permission: "catalog.write",
  handler: (input, ctx) => blogService.upsertProductBlog(ctx, input),
});

export const publishProductBlogAction = defineAction({
  name: "API-CAT-10 publishProductBlog",
  input: blogPublishSchema,
  permission: "content.publish",
  handler: (input, ctx) => blogService.publishProductBlog(ctx, input),
});

export const unpublishProductBlogAction = defineAction({
  name: "API-CAT-10 unpublishProductBlog",
  input: blogPublishSchema,
  permission: "content.publish",
  handler: (input, ctx) => blogService.unpublishProductBlog(ctx, input),
});
