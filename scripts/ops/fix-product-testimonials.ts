/**
 * S-003 follow-up: gibberish testimonials live in `product_testimonials`, not the
 * site-level `testimonials` table. Two specific rows confirmed junk by direct query:
 *   a6e1b13b-7f70-4ad2-937b-ed50d1265672  "demo author" / "demo quote" (CloudPilot, unpublished)
 *   f1a1da21-d8a9-4699-84a4-edcd45048782  "PP" / "HVJHSJB" (published, live on a product page)
 * Deletes exactly these two rows by id, after snapshotting them.
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.production.local", override: true });
process.env.APP_ENV = "production";

import { writeFileSync } from "node:fs";
import { inArray } from "drizzle-orm";

const JUNK_IDS = ["a6e1b13b-7f70-4ad2-937b-ed50d1265672", "f1a1da21-d8a9-4699-84a4-edcd45048782"];

async function main(): Promise<void> {
  const { getDb, closeDb } = await import("../../src/lib/db");
  const { productTestimonials } = await import("../../drizzle/schema/catalog");
  const db = getDb();

  const rows = await db
    .select()
    .from(productTestimonials)
    .where(inArray(productTestimonials.id, JUNK_IDS));
  writeFileSync(
    "scratch/fix-round-2-product-testimonials-snapshot.json",
    JSON.stringify(rows, null, 2),
  );

  const deleted = await db
    .delete(productTestimonials)
    .where(inArray(productTestimonials.id, JUNK_IDS))
    .returning({ id: productTestimonials.id });

  console.table({ product_testimonials_deleted: deleted.length });
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
