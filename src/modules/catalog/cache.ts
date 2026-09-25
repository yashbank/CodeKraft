/**
 * Cache-tag revalidation port (docs/06 §1.10). Services receive `revalidate(tags)` as a dependency
 * so unit/integration tests inject a recorder; the default calls Next's `revalidateTag` and
 * swallows the "outside a request scope" invariant (jobs, scripts, tests) with a debug log.
 */
import { moduleLogger } from "@/lib/logger";

export type Revalidate = (tags: readonly string[]) => Promise<void> | void;

const log = moduleLogger("catalog.cache");

export const nextRevalidate: Revalidate = async (tags) => {
  if (tags.length === 0) return;
  try {
    const { revalidateTag } = await import("next/cache");
    for (const tag of new Set(tags)) revalidateTag(tag);
  } catch (err) {
    log.debug({ err, tags }, "revalidateTag unavailable outside a request scope");
  }
};

/** `product:<slug>` for every distinct slug plus the given base tags (de-duplicated). */
export function productTags(base: readonly string[], ...slugs: (string | null | undefined)[]): string[] {
  const out = new Set<string>(base);
  for (const slug of slugs) if (typeof slug === "string" && slug !== "") out.add(`product:${slug}`);
  return [...out];
}
