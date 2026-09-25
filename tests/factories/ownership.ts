/**
 * Ownership factory (docs/05 §4): one ownership version + its partner lines. Lines go in with a
 * single multi-row INSERT and `SET CONSTRAINTS ALL IMMEDIATE`, so the deferred constraint trigger
 * `trg_ownership_lines_sum` (BR-06) fires on the insert both on the pooled client (statement
 * commit) and inside a test transaction that is later rolled back.
 */
import { and, desc, eq, sql } from "drizzle-orm";

import {
  type ProductOwnership,
  type ProductOwnershipLine,
  productOwnershipLines,
  productOwnerships,
} from "../../drizzle/schema/ownership";
import { type FactoryDb, one, toFactoryDb } from "./context";
import { createAdmin, createPartner } from "./users";

export type OwnershipStatus = ProductOwnership["status"];

export interface OwnershipLineInput {
  partnerId: string;
  shareBps: number;
}

export interface CreateOwnershipOptions {
  productId: string;
  /** Default: one freshly created partner holding 10 000 bps. */
  lines?: readonly OwnershipLineInput[];
  companyCutBps?: number;
  status?: OwnershipStatus;
  /** Default: `max(version) + 1` for the product. */
  version?: number;
  effectiveFrom?: Date | null;
  approvalRequestId?: string | null;
  /** Default: a new admin user. */
  createdBy?: string;
}

export type OwnershipWithLines = ProductOwnership & { lines: ProductOwnershipLine[] };

export async function createOwnership(
  opts: CreateOwnershipOptions,
  db: FactoryDb = toFactoryDb(),
): Promise<OwnershipWithLines> {
  const status = opts.status ?? "active";
  const createdBy = opts.createdBy ?? (await createAdmin({}, db)).id;
  const lines = opts.lines ?? [{ partnerId: (await createPartner({}, db)).id, shareBps: 10_000 }];
  if (lines.length === 0) throw new RangeError("createOwnership: at least one line is required");

  let version = opts.version;
  if (version === undefined) {
    const [latest] = await db
      .select({ version: productOwnerships.version })
      .from(productOwnerships)
      .where(eq(productOwnerships.productId, opts.productId))
      .orderBy(desc(productOwnerships.version))
      .limit(1);
    version = (latest?.version ?? 0) + 1;
  }

  const ownership = one(
    await db
      .insert(productOwnerships)
      .values({
        productId: opts.productId,
        version,
        companyCutBps: opts.companyCutBps ?? 0,
        status,
        effectiveFrom:
          opts.effectiveFrom === undefined
            ? status === "active"
              ? new Date()
              : null
            : opts.effectiveFrom,
        approvalRequestId: opts.approvalRequestId ?? null,
        createdBy,
      })
      .returning(),
    "product_ownerships",
  );

  // No-op (with a swallowed WARNING) outside a transaction block; inside one it makes the
  // deferred sum check fire on the very next statement instead of at COMMIT.
  await db.execute(sql`SET CONSTRAINTS ALL IMMEDIATE`);
  const inserted = await db
    .insert(productOwnershipLines)
    .values(
      lines.map((l) => ({
        ownershipId: ownership.id,
        partnerId: l.partnerId,
        shareBps: l.shareBps,
      })),
    )
    .returning();
  return { ...ownership, lines: inserted };
}

/** The product's `active` ownership version with its lines, or `null`. */
export async function findActiveOwnership(
  productId: string,
  db: FactoryDb = toFactoryDb(),
): Promise<OwnershipWithLines | null> {
  const [row] = await db
    .select()
    .from(productOwnerships)
    .where(and(eq(productOwnerships.productId, productId), eq(productOwnerships.status, "active")))
    .limit(1);
  if (row === undefined) return null;
  const lines = await db
    .select()
    .from(productOwnershipLines)
    .where(eq(productOwnershipLines.ownershipId, row.id));
  return { ...row, lines };
}
