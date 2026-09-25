import { beforeAll, describe, expect, it } from "vitest";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { products } from "../../../drizzle/schema/catalog";
import { jobRuns } from "../../../drizzle/schema/ops";
import { scheduledPublishJob } from "@/jobs/publish";
import { truncateAll } from "../../setup/db";
import { migrateTestDb } from "../../setup/migrate";
import { createProduct } from "../../factories/catalog";

describe("publish.scheduled job integration (docs/06 §3.3, docs/12 §2.3, P3.9)", () => {
  beforeAll(async () => {
    await migrateTestDb();
  });

  it("publishes products whose scheduled time has passed and logs to job_runs", async () => {
    await truncateAll();

    const now = new Date();
    const pastDate = new Date(now.getTime() - 3600 * 1000); // 1 hr ago
    const futureDate = new Date(now.getTime() + 3600 * 1000); // 1 hr in future

    // 1. Create Product A: past scheduled date
    const prodA = await createProduct({
      status: "scheduled",
      name: "Past Scheduled Product",
      overrides: {
        publishAt: pastDate,
      },
    });

    // 2. Create Product B: future scheduled date
    const prodB = await createProduct({
      status: "scheduled",
      name: "Future Scheduled Product",
      overrides: {
        publishAt: futureDate,
      },
    });

    // 3. Execute cron job
    const result = await scheduledPublishJob.run(now);
    expect(result.count).toBe(1);
    expect(result.publishedProductIds).toContain(prodA.id);
    expect(result.publishedProductIds).not.toContain(prodB.id);

    // 4. Verify DB state for Product A
    const [updatedA] = await db.select().from(products).where(eq(products.id, prodA.id));
    expect(updatedA?.status).toBe("published");
    expect(updatedA?.publishedAt).toBeDefined();
    expect(updatedA?.publishAt).toBeNull();

    // 5. Verify DB state for Product B (remains scheduled)
    const [updatedB] = await db.select().from(products).where(eq(products.id, prodB.id));
    expect(updatedB?.status).toBe("scheduled");
    expect(updatedB?.publishedAt).toBeNull();
    expect(updatedB?.publishAt).toBeDefined();

    // 6. Verify job_runs entry
    const [latestJob] = await db
      .select()
      .from(jobRuns)
      .where(eq(jobRuns.job, "publish.scheduled"))
      .orderBy(desc(jobRuns.startedAt))
      .limit(1);

    expect(latestJob).toBeDefined();
    expect(latestJob?.status).toBe("ok");
    expect(latestJob?.finishedAt).toBeDefined();

    // 7. Idempotent replay: running again publishes 0 products
    const replay = await scheduledPublishJob.run(now);
    expect(replay.count).toBe(0);
  });
});
