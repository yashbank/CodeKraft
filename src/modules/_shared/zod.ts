/**
 * Shared Zod primitives — the ONE canonical set for every module (docs/06 §1.3 validation,
 * §1.8 pagination, §1.9 money/time/identifiers; ADR-10 rich text; PHASE-02 P2.8).
 *
 * Rules:
 *  - Objects are `strictObject` (unknown keys → `VALIDATION`), strings are trimmed.
 *  - `Money` = `{ amountMinor: int ≥ 0, currency }` in integer minor units (D-518); no floats.
 *  - Ids are UUIDs; timestamps are ISO-8601 UTC (`2026-09-24T10:15:00.000Z`); dates `YYYY-MM-DD`.
 *  - Lists take `{ cursor?, limit?, sort?, filters?, q? }` and return `ListResult<T>`.
 *
 * Every module re-exports these under its historical names (`uuidSchema` / `zUuid` / `uuid` …)
 * so P2.5–P2.7 public surfaces stay stable; new code imports from here directly.
 */
import { z } from "zod";
import { CURRENCIES, type Currency } from "@/lib/money";

/* ========================================================================================== */
/* Identifiers, money, time (docs/06 §1.3, §1.9)                                              */
/* ========================================================================================== */

export const uuidSchema = z.uuid();

/** `^[a-z0-9]+(?:-[a-z0-9]+)*$`, max 80 (docs/06 §1.3). */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(SLUG_PATTERN, "lower-case letters, digits and single hyphens only");

export const currencySchema = z.enum(CURRENCIES);
export type { Currency };

/** Non-negative integer minor units (paise / cents). */
export const minorUnitsSchema = z.number().int().nonnegative();
/** Strictly positive minor units (amounts that must be > 0). */
export const positiveMinorUnitsSchema = z.number().int().positive();
/** Signed minor units (adjustments, ledger amounts). */
export const signedMinorUnitsSchema = z.number().int();

/** `{ amountMinor: int ≥ 0, currency }` — docs/06 §1.3, D-518. */
export const moneySchema = z.strictObject({
  amountMinor: minorUnitsSchema,
  currency: currencySchema,
});
export type MoneyInput = z.infer<typeof moneySchema>;

/** Basis points 0..10000 (docs/06 §1.3). */
export const bpsSchema = z.number().int().min(0).max(10_000);

/** `YYYY-MM-DD` (docs/06 §1.9). */
export const isoDateSchema = z.iso.date();
/** ISO-8601 UTC timestamp `2026-09-24T10:15:00.000Z` (docs/06 §1.9). */
export const isoDateTimeSchema = z.iso.datetime();

/** Trimmed, bounded free text. */
export const trimmedString = (min: number, max: number) => z.string().trim().min(min).max(max);

/* ========================================================================================== */
/* Rich text — Tiptap JSON allow-list (ADR-10, docs/09 TM-21)                                  */
/* ========================================================================================== */

export const RICH_TEXT_NODE_TYPES = [
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "horizontalRule",
  "image",
  "table",
  "tableRow",
  "tableCell",
  "tableHeader",
] as const;
export const RICH_TEXT_MARK_TYPES = [
  "bold",
  "italic",
  "underline",
  "strike",
  "code",
  "link",
] as const;
export const RICH_TEXT_MAX_DEPTH = 32;

const SAFE_HREF = /^(https?:\/\/|mailto:|\/(?!\/))/i;
const richTextAttrsSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .refine(
    (attrs) => typeof attrs["href"] !== "string" || SAFE_HREF.test(attrs["href"]),
    "href must be http(s), mailto or a relative path",
  )
  .refine(
    (attrs) => typeof attrs["src"] !== "string" || SAFE_HREF.test(attrs["src"]),
    "src must be http(s) or a relative path",
  );

const richTextMarkSchema = z.strictObject({
  type: z.enum(RICH_TEXT_MARK_TYPES),
  attrs: richTextAttrsSchema.optional(),
});

export interface RichTextNode {
  type: (typeof RICH_TEXT_NODE_TYPES)[number];
  attrs?: Record<string, string | number | boolean | null>;
  content?: RichTextNode[];
  marks?: {
    type: (typeof RICH_TEXT_MARK_TYPES)[number];
    attrs?: Record<string, string | number | boolean | null>;
  }[];
  text?: string;
}

export const richTextNodeSchema: z.ZodType<RichTextNode> = z.lazy(() =>
  z.strictObject({
    type: z.enum(RICH_TEXT_NODE_TYPES),
    attrs: richTextAttrsSchema.optional(),
    content: z.array(richTextNodeSchema).max(5_000).optional(),
    marks: z.array(richTextMarkSchema).max(16).optional(),
    text: z.string().max(100_000).optional(),
  }),
);

/** A Tiptap `doc`; anything outside the allow-list (e.g. `script`, `iframe`) is rejected. */
export const richTextSchema = z.strictObject({
  type: z.literal("doc"),
  content: z.array(richTextNodeSchema).max(5_000).optional(),
});
export type RichTextDoc = z.infer<typeof richTextSchema>;

/* ========================================================================================== */
/* Lists — cursor pagination (docs/06 §1.8)                                                    */
/* ========================================================================================== */

export const LIST_LIMIT_MAX = 100;
export const LIST_LIMIT_DEFAULT = 25;
/** Opaque cursor (base64url of the last row's sort key + id). */
export const cursorSchema = z.string().min(1).max(512);
export const limitSchema = z.number().int().min(1).max(LIST_LIMIT_MAX).default(LIST_LIMIT_DEFAULT);

export type SortKey<F extends string> = `${F}:asc` | `${F}:desc`;

/** `{ cursor?, limit }` — the pagination slice every list input carries. */
export interface CursorPagination {
  cursor?: string;
  limit: number;
}

/** Parsed list input for sort fields `F` and filters `Filters`. */
export interface ListParams<F extends string = string, Filters = Record<never, never>> {
  cursor?: string;
  limit: number;
  sort?: SortKey<F>;
  filters?: Filters;
  q?: string;
}

/** A page of a cursor-paginated list; `total` only where the docs/06 row promises it. */
export interface ListResult<T> {
  items: T[];
  nextCursor: string | null;
  total?: number;
}

/**
 * `{ cursor?, limit?, sort?, filters?, q? }` for a list query. `sortFields` and `filters` are
 * the documented allow-lists — anything else → `VALIDATION`.
 */
export function listParams<
  const F extends readonly [string, ...string[]],
  S extends z.ZodObject = z.ZodObject<Record<never, never>>,
>(sortFields: F, filters?: S) {
  const sortValues = sortFields.flatMap((f) => [`${f}:asc`, `${f}:desc`]) as [
    SortKey<F[number]>,
    ...SortKey<F[number]>[],
  ];
  return z.strictObject({
    cursor: cursorSchema.optional(),
    limit: limitSchema,
    sort: z.enum(sortValues).optional(),
    filters: (filters ?? (z.strictObject({}) as unknown as S)).optional(),
    q: z.string().trim().max(200).optional(),
  });
}
