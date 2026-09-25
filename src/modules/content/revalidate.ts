/**
 * Cache-tag revalidation (docs/06 §1.10, docs/04 §7.7). Actions call `revalidateTags` after the
 * service transaction committed. Outside a Next.js request scope (`vitest`, scripts, jobs)
 * `next/cache` throws an invariant — swallowed and logged at debug level, never surfaced.
 * `setRevalidateTagFn` lets tests assert the documented tag set via a spy.
 */
import { revalidateTag as nextRevalidateTag } from "next/cache";
import { getLogger } from "@/lib/logger";
import { uniqueTags } from "./internal";

export type RevalidateTagFn = (tag: string) => void;

const defaultFn: RevalidateTagFn = (tag) => {
  nextRevalidateTag(tag);
};

let current: RevalidateTagFn = defaultFn;

export function setRevalidateTagFn(fn: RevalidateTagFn | undefined): void {
  current = fn ?? defaultFn;
}

/** Revalidate every tag once, in order; failures are logged, never thrown. */
export function revalidateTags(tags: readonly (string | null | undefined)[]): string[] {
  const list = uniqueTags(tags);
  for (const tag of list) {
    try {
      current(tag);
    } catch (err) {
      getLogger().debug({ err, tag }, "revalidateTag skipped (no request scope)");
    }
  }
  return list;
}

/* --- docs/06 §1.10 tag builders ------------------------------------------------------------- */

export const TAG_CATALOG = "catalog";
export const TAG_BLOG = "blog";
export const TAG_CONTENT = "content";
export const TAG_CASE_STUDIES = "case-studies";
export const TAG_SETTINGS = "settings";
export const TAG_SITEMAP = "sitemap";

export const productTag = (slug: string) => `product:${slug}`;
export const blogTag = (slug: string) => `blog:${slug}`;
export const caseStudyTag = (slug: string) => `case-study:${slug}`;
