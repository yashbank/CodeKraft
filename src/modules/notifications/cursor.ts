/**
 * Opaque list cursors (docs/06 §1.8): base64url of `{ v: <sort value>, id }` — the last row's
 * sort key plus its id for a stable keyset. Malformed cursors → `VALIDATION`. Shared by the P6
 * modules (leads, queries, notifications).
 */
import { AppError, ErrorCode } from "@/lib/errors";

export interface Cursor<V extends string | number = string | number> {
  v: V;
  id: string;
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(raw: string | undefined): Cursor | undefined {
  if (raw === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "v" in parsed &&
      "id" in parsed &&
      typeof (parsed as { id: unknown }).id === "string" &&
      (typeof (parsed as { v: unknown }).v === "string" ||
        typeof (parsed as { v: unknown }).v === "number")
    ) {
      return { v: (parsed as Cursor).v, id: (parsed as Cursor).id };
    }
  } catch {
    // fall through
  }
  throw new AppError(ErrorCode.VALIDATION, "Invalid cursor.", {
    fieldErrors: { cursor: ["invalid cursor"] },
  });
}

/** Fetch `limit + 1` rows, return the page and the cursor of the next one (or `null`). */
export function paginate<T>(
  rows: readonly T[],
  limit: number,
  cursorOf: (row: T) => Cursor,
): { items: T[]; nextCursor: string | null } {
  if (rows.length <= limit) return { items: [...rows], nextCursor: null };
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: last === undefined ? null : encodeCursor(cursorOf(last)) };
}
