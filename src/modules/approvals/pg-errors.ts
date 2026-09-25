/**
 * Postgres error inspection for services (drizzle wraps driver errors in `DrizzleQueryError`
 * with the `postgres` error on `cause`). Maps unique violations and named trigger exceptions
 * (drizzle/custom/triggers.sql) to `AppError`s so callers never leak SQL to the client.
 *
 * Candidate for `src/modules/_shared` once more modules need it (P3 shared-file note).
 */
import { AppError, ErrorCode } from "@/lib/errors";

export interface PgErrorInfo {
  code: string;
  message: string;
  constraint?: string;
  detail?: string;
}

const SQLSTATE = /^[0-9A-Z]{5}$/;

/** The innermost error in the `cause` chain that carries a SQLSTATE `code`, or `undefined`. */
export function pgError(err: unknown): PgErrorInfo | undefined {
  let found: PgErrorInfo | undefined;
  for (let e: unknown = err; typeof e === "object" && e !== null; e = (e as { cause?: unknown }).cause) {
    const candidate = e as { code?: unknown; message?: unknown; constraint_name?: unknown; detail?: unknown };
    if (typeof candidate.code === "string" && SQLSTATE.test(candidate.code)) {
      found = {
        code: candidate.code,
        message: typeof candidate.message === "string" ? candidate.message : "",
        ...(typeof candidate.constraint_name === "string"
          ? { constraint: candidate.constraint_name }
          : {}),
        ...(typeof candidate.detail === "string" ? { detail: candidate.detail } : {}),
      };
    }
  }
  return found;
}

export const PG_UNIQUE_VIOLATION = "23505";
export const PG_FK_VIOLATION = "23503";
export const PG_INTEGRITY_VIOLATION = "23000";

export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const info = pgError(err);
  if (info === undefined || info.code !== PG_UNIQUE_VIOLATION) return false;
  return constraint === undefined || info.constraint === constraint;
}

export function isForeignKeyViolation(err: unknown): boolean {
  return pgError(err)?.code === PG_FK_VIOLATION;
}

/** True when a `RAISE EXCEPTION '<name>'` from drizzle/custom/triggers.sql caused `err`. */
export function isTriggerError(err: unknown, name: string): boolean {
  const info = pgError(err);
  return info !== undefined && info.message.includes(name);
}

export interface PgErrorMapping {
  unique?: (info: PgErrorInfo) => AppError;
  foreignKey?: (info: PgErrorInfo) => AppError;
  triggers?: Record<string, (info: PgErrorInfo) => AppError>;
}

/**
 * Rethrow `err` as the mapped `AppError` when it matches, else rethrow unchanged. Usage:
 * `catch (err) { throw mapPgError(err, { unique: () => new AppError(ErrorCode.CONFLICT) }); }`
 */
export function mapPgError(err: unknown, mapping: PgErrorMapping): unknown {
  const info = pgError(err);
  if (info === undefined) return err;
  if (info.code === PG_UNIQUE_VIOLATION && mapping.unique !== undefined) return mapping.unique(info);
  if (info.code === PG_FK_VIOLATION && mapping.foreignKey !== undefined) {
    return mapping.foreignKey(info);
  }
  for (const [name, build] of Object.entries(mapping.triggers ?? {})) {
    if (info.message.includes(name)) return build(info);
  }
  return err;
}

export function conflict(message?: string): AppError {
  return new AppError(ErrorCode.CONFLICT, message);
}
