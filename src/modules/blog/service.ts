/**
 * `blog` service — NotImplemented skeleton (PHASE-02 P2.8). Bodies land in P3; the signatures are
 * the frozen `BlogService` contract in `./contracts.ts` (master plan §5, docs/06 §6) and must not
 * change without an ADR.
 */
import { createNotImplemented } from "@/modules/_shared/not-implemented";
import type { BlogService } from "./contracts";

/** Every member throws / rejects `AppError(INTERNAL, "blog.<method> not implemented (P3)")`. */
export function createNotImplementedBlogService(): BlogService {
  return createNotImplemented<BlogService>("blog", "P3", {
    upsertProductBlog: "async",
    publishProductBlog: "async",
    unpublishProductBlog: "async",
    listBlogPosts: "async",
    getBlogBySlug: "async",
    listBlogTeasers: "async",
  });
}
