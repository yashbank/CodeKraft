/**
 * Cursor pagination helpers (docs/06 §1.8): the cursor is base64url of `[sortValue, id]`.
 */
import { AppError, ErrorCode } from "@/lib/errors";

export interface CursorParts {
  /** ISO timestamp, string or number — whatever the sort column holds. */
  value: string | number | null;
  id: string;
}

export function encodeCursor(parts: CursorParts): string {
  return Buffer.from(JSON.stringify([parts.value, parts.id]), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorParts {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      (typeof parsed[0] === "string" || typeof parsed[0] === "number" || parsed[0] === null) &&
      typeof parsed[1] === "string"
    ) {
      return { value: parsed[0], id: parsed[1] };
    }
  } catch {
    // fall through
  }
  throw new AppError(ErrorCode.VALIDATION, "invalid cursor", { fieldErrors: { cursor: ["invalid"] } });
}

export function parseSort<F extends string>(
  sort: `${F}:asc` | `${F}:desc` | undefined,
  fallback: { field: F; dir: "asc" | "desc" },
): { field: F; dir: "asc" | "desc" } {
  if (sort === undefined) return fallback;
  const at = sort.lastIndexOf(":");
  return { field: sort.slice(0, at) as F, dir: sort.slice(at + 1) as "asc" | "desc" };
}
