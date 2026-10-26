/**
 * BUG-038 fix: `legal_pages` has 0 rows in production, so admin Content > Legal shows an empty
 * state. This provisions the same 4 keys (privacy/terms/refunds/license) that
 * scripts/seed/content.ts already defines for non-production seeding, reusing that copy here so
 * production gets *something* to replace rather than nothing.
 *
 * Rows are inserted as DRAFT: title prefixed `[DRAFT]` and `publishedAt` left null (unpublished),
 * since this placeholder copy has had no legal review and must not look live. A human must
 * replace the content and publish for real before launch (see MANUAL.md).
 *
 * Idempotent: INSERT ... ON CONFLICT (key) DO NOTHING — safe to run repeatedly, never overwrites
 * an existing row (including one a human has since edited/published).
 *
 * Default is DRY RUN: prints what would be inserted, writes nothing. --apply performs the insert.
 * Takes its DB connection from env the same way other scripts/ops/*.ts do (DATABASE_URL via
 * src/lib/db), so pointing it at production is an explicit operator choice (env file), not
 * something this script decides.
 *
 * Run: pnpm tsx scripts/ops/provision-legal-pages.ts [--apply]
 */
// Same env-loading pattern as scripts/ops/wipe-demo-data.ts: .env.production.local (if present)
// overrides DATABASE_URL last, so pointing this at production is an explicit operator choice
// (that file existing) rather than something this script decides.
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env" });
loadEnv({ path: ".env.production.local", override: true });

import { legalPages } from "../../drizzle/schema/content";
import { tiptap } from "../seed/shared";

const DRAFT_PREFIX = "[DRAFT]";

function draftTitle(title: string): string {
  return title.startsWith(DRAFT_PREFIX) ? title : `${DRAFT_PREFIX} ${title}`;
}

// Same 4 keys/copy as scripts/seed/content.ts LEGAL_PAGES — kept in sync by hand since the seed
// module is for non-production environments and intentionally does not import from scripts/ops.
const LEGAL_PAGES: {
  key: "privacy" | "terms" | "refunds" | "license";
  title: string;
  body: string[];
}[] = [
  {
    key: "privacy",
    title: "Privacy policy",
    body: [
      "This placeholder privacy policy must be replaced before launch. It should cover what we collect, cookies (strictly necessary only), the AI assistant provider and retention periods.",
    ],
  },
  {
    key: "terms",
    title: "Terms of service",
    body: [
      "This placeholder terms-of-service text must be replaced before launch. It should cover accounts, purchases, acceptable use and governing law (India).",
    ],
  },
  {
    key: "refunds",
    title: "Refund and cancellation policy",
    body: [
      "This placeholder refund policy must be replaced before launch.",
      "Payments are currently accepted by manual UPI and bank transfer only; refunds are returned to the originating account after admin approval.",
      "[PLACEHOLDER: gateway wording] When card or gateway payments are enabled, this section will describe gateway refund timelines.",
    ],
  },
  {
    key: "license",
    title: "Product license",
    body: [
      "This placeholder product license must be replaced before launch. It should define perpetual licenses, download-based access, update policies and permitted use.",
    ],
  },
];

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const { getDb, closeDb } = await import("../../src/lib/db");
  const db = getDb();

  const existing = await db.select({ key: legalPages.key }).from(legalPages);
  const existingKeys = new Set(existing.map((r) => r.key));

  console.log(`mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(
    `existing legal_pages rows: ${existing.length} (${[...existingKeys].join(", ") || "none"})`,
  );

  let inserted = 0;
  for (const page of LEGAL_PAGES) {
    if (existingKeys.has(page.key)) {
      console.log(`SKIP  ${page.key}: already exists`);
      continue;
    }

    const title = draftTitle(page.title);
    console.log(`${apply ? "INSERT" : "WOULD INSERT"} ${page.key}: "${title}" (unpublished draft)`);

    if (!apply) continue;

    const rows = await db
      .insert(legalPages)
      .values({
        key: page.key,
        title,
        bodyJson: tiptap(...page.body),
        version: 1,
        publishedAt: null,
      })
      .onConflictDoNothing({ target: legalPages.key })
      .returning({ id: legalPages.id });
    inserted += rows.length;
  }

  console.log(
    `\n${apply ? "inserted" : "would insert"}: ${apply ? inserted : LEGAL_PAGES.length - existingKeys.size} row(s)`,
  );
  if (!apply) console.log("dry run only, no changes made. Re-run with --apply to write.");

  await closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
