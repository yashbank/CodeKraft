/**
 * One-off prod content cleanup (BUG-TRACKER.md cluster 3/5/10, fix/round-2 batch).
 * Removes demo/junk rows hand-entered via admin UI: gibberish testimonials and
 * CloudPilot's demo offerings/FAQs/media. Snapshots every row it deletes to
 * scratch/fix-round-2-snapshot.json before deleting, so the delete is reversible.
 *
 * Run: tsx scripts/ops/fix-content-batch-round2.ts
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.production.local", override: true });
process.env.APP_ENV = "production";

import { writeFileSync, mkdirSync } from "node:fs";
import { eq, or, like } from "drizzle-orm";

async function main(): Promise<void> {
  const [
    { getDb, closeDb },
    { testimonials },
    { products, productFaqs, productMedia },
    { offerings },
  ] = await Promise.all([
    import("../../src/lib/db"),
    import("../../drizzle/schema/content"),
    import("../../drizzle/schema/catalog"),
    import("../../drizzle/schema/offerings"),
  ]);
  const db = getDb();

  const junkTestimonials = await db
    .select()
    .from(testimonials)
    .where(
      or(
        like(testimonials.quote, "%kbhfbqhedbkqhjwbdhjbqw%"),
        like(testimonials.quote, "%qkdblewbfhqwe%"),
        like(testimonials.quote, "%qefqefqer23r%"),
      ),
    );

  const [cloudPilot] = await db
    .select()
    .from(products)
    .where(eq(products.slug, "cloudpilot-managed-platform"));
  if (!cloudPilot) throw new Error("cloudpilot-managed-platform product not found");

  const junkOfferings = await db
    .select()
    .from(offerings)
    .where(eq(offerings.productId, cloudPilot.id));
  const junkFaqs = await db
    .select()
    .from(productFaqs)
    .where(eq(productFaqs.productId, cloudPilot.id));
  const junkMedia = await db
    .select()
    .from(productMedia)
    .where(eq(productMedia.productId, cloudPilot.id));

  mkdirSync("scratch", { recursive: true });
  writeFileSync(
    "scratch/fix-round-2-snapshot.json",
    JSON.stringify({ junkTestimonials, cloudPilot, junkOfferings, junkFaqs, junkMedia }, null, 2),
  );

  for (const row of junkTestimonials)
    await db.delete(testimonials).where(eq(testimonials.id, row.id));
  for (const row of junkOfferings) await db.delete(offerings).where(eq(offerings.id, row.id));
  for (const row of junkFaqs) await db.delete(productFaqs).where(eq(productFaqs.id, row.id));
  for (const row of junkMedia) await db.delete(productMedia).where(eq(productMedia.id, row.id));

  console.table({
    testimonials_deleted: junkTestimonials.length,
    cloudpilot_offerings_deleted: junkOfferings.length,
    cloudpilot_faqs_deleted: junkFaqs.length,
    cloudpilot_media_deleted: junkMedia.length,
  });
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
