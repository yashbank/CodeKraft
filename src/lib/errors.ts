/**
 * Application error model — docs/06 §1.4.
 *
 * `ErrorCode` and the HTTP mapping are verbatim from the result-envelope table. Server Actions
 * never throw `AppError` to the client: `toActionResult` converts any thrown value into the
 * `{ ok: false, error }` envelope; Route Handlers use `httpStatus` for the response code.
 */

export enum ErrorCode {
  UNAUTHENTICATED = "UNAUTHENTICATED",
  SESSION_REPLACED = "SESSION_REPLACED",
  EMAIL_UNVERIFIED = "EMAIL_UNVERIFIED",
  ACCOUNT_SUSPENDED = "ACCOUNT_SUSPENDED",
  FORBIDDEN = "FORBIDDEN",
  VALIDATION = "VALIDATION",
  CAPTCHA_FAILED = "CAPTCHA_FAILED",
  NOT_FOUND = "NOT_FOUND",
  STATE_INVALID = "STATE_INVALID",
  CONFLICT = "CONFLICT",
  DUPLICATE_PURCHASE = "DUPLICATE_PURCHASE",
  ORDER_EXPIRED = "ORDER_EXPIRED",
  LIMIT_EXCEEDED = "LIMIT_EXCEEDED",
  RATE_LIMITED = "RATE_LIMITED",
  IDEMPOTENT_REPLAY = "IDEMPOTENT_REPLAY",
  UPSTREAM_UNAVAILABLE = "UPSTREAM_UNAVAILABLE",
  INTERNAL = "INTERNAL",
}

/** docs/06 §1.4 — code → HTTP status. */
export const ERROR_HTTP_STATUS: Readonly<Record<ErrorCode, number>> = Object.freeze({
  [ErrorCode.UNAUTHENTICATED]: 401,
  [ErrorCode.SESSION_REPLACED]: 401,
  [ErrorCode.EMAIL_UNVERIFIED]: 403,
  [ErrorCode.ACCOUNT_SUSPENDED]: 403,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.VALIDATION]: 400,
  [ErrorCode.CAPTCHA_FAILED]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.STATE_INVALID]: 409,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.DUPLICATE_PURCHASE]: 409,
  [ErrorCode.ORDER_EXPIRED]: 410,
  [ErrorCode.LIMIT_EXCEEDED]: 429,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.IDEMPOTENT_REPLAY]: 200,
  [ErrorCode.UPSTREAM_UNAVAILABLE]: 503,
  [ErrorCode.INTERNAL]: 500,
});

/** Default, client-safe messages. Never include secrets, SQL or stack fragments in messages. */
export const ERROR_DEFAULT_MESSAGE: Readonly<Record<ErrorCode, string>> = Object.freeze({
  [ErrorCode.UNAUTHENTICATED]: "You need to sign in.",
  [ErrorCode.SESSION_REPLACED]: "You were signed in on another device.",
  [ErrorCode.EMAIL_UNVERIFIED]: "Please verify your email address first.",
  [ErrorCode.ACCOUNT_SUSPENDED]: "This account is suspended.",
  [ErrorCode.FORBIDDEN]: "You do not have permission to do that.",
  [ErrorCode.VALIDATION]: "Some fields are invalid.",
  [ErrorCode.CAPTCHA_FAILED]: "Captcha verification failed. Please try again.",
  [ErrorCode.NOT_FOUND]: "Not found.",
  [ErrorCode.STATE_INVALID]: "This action is not allowed in the current state.",
  [ErrorCode.CONFLICT]: "The record was changed by someone else. Reload and try again.",
  [ErrorCode.DUPLICATE_PURCHASE]: "You already own this.",
  [ErrorCode.ORDER_EXPIRED]: "This order has expired.",
  [ErrorCode.LIMIT_EXCEEDED]: "Limit reached.",
  [ErrorCode.RATE_LIMITED]: "Too many requests. Please wait and try again.",
  [ErrorCode.IDEMPOTENT_REPLAY]: "Already processed.",
  [ErrorCode.UPSTREAM_UNAVAILABLE]:
    "A service we depend on is unavailable. Please try again later.",
  [ErrorCode.INTERNAL]: "Something went wrong.",
});

export type FieldErrors = Record<string, string[]>;

export interface ActionError {
  code: ErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
  retryAfterMs?: number;
}

/** docs/06 §1.4 result envelope. */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: ActionError };

export interface AppErrorOptions {
  fieldErrors?: FieldErrors;
  retryAfterMs?: number;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors: FieldErrors | undefined;
  readonly retryAfterMs: number | undefined;
  override readonly cause: unknown;

  constructor(code: ErrorCode, message?: string, options: AppErrorOptions = {}) {
    super(message ?? ERROR_DEFAULT_MESSAGE[code]);
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = options.fieldErrors;
    this.retryAfterMs = options.retryAfterMs;
    this.cause = options.cause;
  }

  /** HTTP status for Route Handlers (docs/06 §1.4 table). */
  get httpStatus(): number {
    return ERROR_HTTP_STATUS[this.code];
  }

  /** The wire-safe error object of the envelope. */
  toActionError(): ActionError {
    const error: ActionError = { code: this.code, message: this.message };
    if (this.fieldErrors !== undefined) error.fieldErrors = this.fieldErrors;
    if (this.retryAfterMs !== undefined) error.retryAfterMs = this.retryAfterMs;
    return error;
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * Convert any thrown value into the failure envelope. Non-`AppError` values become `INTERNAL`
 * with the generic message (details are for Sentry/logs, never the client). P1.6 `defineAction`
 * appends the Sentry event id to the message when one is available.
 */
export function toActionResult(err: unknown): ActionResult<never> {
  if (isAppError(err)) return { ok: false, error: err.toActionError() };
  return {
    ok: false,
    error: { code: ErrorCode.INTERNAL, message: ERROR_DEFAULT_MESSAGE[ErrorCode.INTERNAL] },
  };
}

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(
  code: ErrorCode,
  message?: string,
  options: AppErrorOptions = {},
): ActionResult<never> {
  return toActionResult(new AppError(code, message, options));
}
