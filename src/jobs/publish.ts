/**
 * publish.scheduled cron job (docs/06 §3.3, docs/12 §2.3, PHASE-03 P3.9).
 * Finds products with status = 'scheduled' and publish_at <= now,
 * transitions them to 'published', updates published_at, revalidates caches,
 * and records the execution in job_runs table.
 */
import { and, eq, lte } from "drizzle-orm";
import { db, withTx } from "@/lib/db";
import { products } from "../../drizzle/schema/catalog";
import { jobRuns } from "../../drizzle/schema/ops";
import { revalidateTagsSafe } from "@/lib/revalidate";

export interface ScheduledPublishResult {
  publishedProductIds: string[];
  count: number;
}

export const scheduledPublishJob = {
  key: "publish.scheduled" as const,

  async run(now: Date = new Date()): Promise<ScheduledPublishResult> {
    const startedAt = new Date();
    let status: "ok" | "error" = "ok";
    let detail: Record<string, unknown> = {};

    try {
      // Find all scheduled products ready to publish
      const readyProducts = await db
        .select({
          id: products.id,
          slug: products.slug,
          publishAt: products.publishAt,
        })
        .from(products)
        .where(and(eq(products.status, "scheduled"), lte(products.publishAt, now)));

      const publishedProductIds: string[] = [];

      for (const prod of readyProducts) {
        await withTx(async (tx) => {
          // Verify still scheduled before updating (idempotency guard)
          const [updated] = await tx
            .update(products)
            .set({
              status: "published",
              publishedAt: now,
              publishAt: null,
              updatedAt: now,
            })
            .where(and(eq(products.id, prod.id), eq(products.status, "scheduled")))
            .returning({ id: products.id });

          if (updated) {
            publishedProductIds.push(updated.id);
            revalidateTagsSafe(["catalog", "sitemap", `product:${prod.slug}`]);
          }
        });
      }

      detail = {
        publishedProductIds,
        count: publishedProductIds.length,
      };

      return {
        publishedProductIds,
        count: publishedProductIds.length,
      };
    } catch (err: unknown) {
      status = "error";
      detail = {
        error: err instanceof Error ? err.message : String(err),
      };
      throw err;
    } finally {
      await db.insert(jobRuns).values({
        job: "publish.scheduled",
        startedAt,
        finishedAt: new Date(),
        status,
        detail,
      });
    }
  },
};
