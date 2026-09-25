/**
 * Plumbing shared by the seed steps (scripts/seed/*): the context every step receives, the
 * per-table tally that becomes the summary table, and small content helpers.
 *
 * Seeds are data only (D-018): nothing under `src/**` imports from `scripts/**`. The steps import
 * `src/**` and `drizzle/**` (and the P2.9 factories) the other way round.
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import type { TiptapDoc } from "../../drizzle/schema/catalog";
import type { FactoryDb } from "../../tests/factories/context";

export type SeedDb = FactoryDb;

/** `full` = docs/05 §14 dataset (local, preview, staging); `production` = docs/12 §1 subset. */
export type SeedMode = "full" | "production";

/**
 * Seeded content is placeholder copy the founders replace before launch (MASTER_SPEC §7 "Domain
 * before launch", docs/13 R1-26). Every seeded content title carries this prefix so the P9
 * no-placeholder test can find what is still unedited.
 */
export const PLACEHOLDER = "[PLACEHOLDER]";

export function placeholder(title: string): string {
  return title.startsWith(PLACEHOLDER) ? title : `${PLACEHOLDER} ${title}`;
}

export interface SeedTally {
  /** Rows inserted by this run. */
  created: number;
  /** Rows updated in place by this run (natural-key upserts that refresh content). */
  updated: number;
}

export interface SeedContext {
  db: SeedDb;
  mode: SeedMode;
  log: (message: string) => void;
  /** Per-table tallies, in first-touched order (the summary table follows it). */
  tallies: Map<string, SeedTally>;
}

export function createContext(
  db: SeedDb,
  mode: SeedMode,
  log: (message: string) => void = () => undefined,
): SeedContext {
  return { db, mode, log, tallies: new Map() };
}

/** Record `created`/`updated` rows for a table (call with zeros to list a table that was checked). */
export function tally(ctx: SeedContext, table: string, created = 0, updated = 0): void {
  const t = ctx.tallies.get(table) ?? { created: 0, updated: 0 };
  t.created += created;
  t.updated += updated;
  ctx.tallies.set(table, t);
}

/** `select count(*)` of a table as a number. */
export async function countRows(db: SeedDb, table: PgTable): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table);
  return row?.n ?? 0;
}

/** Tiptap document of one paragraph per string (docs/06 §1.10 allow-list: paragraph + text only). */
export function tiptap(...paragraphs: string[]): TiptapDoc {
  return {
    type: "doc",
    content: paragraphs.map((text) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    })),
  };
}

/** Deterministic hex SHA-256 for placeholder media rows (no object is uploaded). */
export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/** `YYYY-MM-DD` (UTC) — the `date`-column format in string mode. */
export function isoDay(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
