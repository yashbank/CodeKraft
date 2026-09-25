/**
 * Action envelope — docs/06 §1.3 (Zod first), §1.4 (`ActionResult`, never throw to the client),
 * docs/09 §4.2 (permission asserted after parse, before the service).
 *
 * Framework-agnostic: the caller supplies the `Context` (P1.5 `requireContext` from the Better
 * Auth session, P1.7 layouts). Nothing here touches `next/headers`.
 */
import type { z } from "zod";
import {
  type ActionResult,
  AppError,
  ERROR_DEFAULT_MESSAGE,
  ErrorCode,
  type FieldErrors,
  toActionResult,
} from "@/lib/errors";
import { newId } from "@/lib/ids";
import { assertAnyPermission, assertPermission } from "@/lib/authz/assert";
import { type Context, type RequestContext, requireContext } from "@/lib/authz/context";
import type { Permission } from "@/lib/authz/permissions";

export type { ActionResult, FieldErrors } from "@/lib/errors";

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

/** Failure envelope from any thrown value (`AppError` keeps its code; anything else → INTERNAL). */
export function fail(err: unknown): ActionResult<never> {
  return toActionResult(err);
}

/**
 * Throw from a handler to answer an idempotent replay with the original data
 * (docs/06 §1.5: informational, the envelope is `ok: true`).
 */
export class IdempotentReplay<T> {
  readonly code = ErrorCode.IDEMPOTENT_REPLAY;
  constructor(readonly data: T) {}
}

export interface ActionErrorReport {
  readonly action: string;
  readonly incidentId: string;
  readonly requestId: string;
  readonly userId: string | null;
}

/**
 * Hook for the unexpected-error path. P1.8 registers Sentry here; it may return an event id
 * which then replaces the generated incident id in the client message. It must not throw —
 * if it does, the failure is swallowed so the client still receives the envelope.
 */
export type ActionErrorReporter = (err: unknown, report: ActionErrorReport) => string | undefined;

let reporter: ActionErrorReporter | undefined;

export function setActionErrorReporter(fn: ActionErrorReporter | undefined): void {
  reporter = fn;
}

/** Zod issues → `fieldErrors` keyed by dotted path (`items.0.qty`); form-level issues under `_form`. */
export function fieldErrorsFromIssues(issues: readonly z.core.$ZodIssue[]): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of issues) {
    const key = issue.path.length === 0 ? "_form" : issue.path.map(String).join(".");
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

export function validateInput<S extends z.ZodType>(schema: S, raw: unknown): z.output<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(ErrorCode.VALIDATION, undefined, {
      fieldErrors: fieldErrorsFromIssues(parsed.error.issues),
    });
  }
  return parsed.data;
}

export type Action<T> = (rawInput: unknown, ctx: Context) => Promise<ActionResult<T>>;

interface BaseActionSpec<S extends z.ZodType> {
  /** Name used in error reports (e.g. `API-CAT-03 product.update`). */
  name?: string;
  input: S;
}

export interface ActionSpec<S extends z.ZodType, T> extends BaseActionSpec<S> {
  /** One permission, or a list of which the caller needs at least one. */
  permission?: Permission | readonly Permission[];
  handler: (input: z.output<S>, ctx: RequestContext) => Promise<T> | T;
}

export interface PublicActionSpec<S extends z.ZodType, T> extends BaseActionSpec<S> {
  handler: (input: z.output<S>, ctx: Context) => Promise<T> | T;
}

function unexpected(err: unknown, action: string, ctx: Context): ActionResult<never> {
  let incidentId = newId();
  if (reporter !== undefined) {
    try {
      const eventId = reporter(err, {
        action,
        incidentId,
        requestId: ctx.requestId,
        userId: ctx.userId,
      });
      if (typeof eventId === "string" && eventId !== "") incidentId = eventId;
    } catch {
      // The reporter is best-effort; the envelope must still reach the client.
    }
  }
  return {
    ok: false,
    error: {
      code: ErrorCode.INTERNAL,
      message: `${ERROR_DEFAULT_MESSAGE[ErrorCode.INTERNAL]} Reference: ${incidentId}`,
    },
  };
}

async function run<S extends z.ZodType, T>(
  spec: BaseActionSpec<S>,
  raw: unknown,
  ctx: Context,
  body: (input: z.output<S>) => Promise<T> | T,
): Promise<ActionResult<T>> {
  const action = spec.name ?? "action";
  try {
    const input = validateInput(spec.input, raw);
    return ok(await body(input));
  } catch (err) {
    if (err instanceof IdempotentReplay) return ok(err.data as T);
    if (err instanceof AppError) return toActionResult(err);
    return unexpected(err, action, ctx);
  }
}

/**
 * Authenticated action: parse → `UNAUTHENTICATED` on anonymous → permission (any-of when a
 * list) → handler. Every exit is an `ActionResult`; nothing is thrown to the caller.
 */
export function defineAction<S extends z.ZodType, T>(spec: ActionSpec<S, T>): Action<T> {
  return (raw, ctx) =>
    run(spec, raw, ctx, (input) => {
      const authed = requireContext(ctx);
      if (typeof spec.permission === "string") assertPermission(authed, spec.permission);
      else if (spec.permission !== undefined) assertAnyPermission(authed, spec.permission);
      return spec.handler(input, authed);
    });
}

/** Action callable without a session (inquiry form, public search). Still Zod-first, never throws. */
export function definePublicAction<S extends z.ZodType, T>(
  spec: PublicActionSpec<S, T>,
): Action<T> {
  return (raw, ctx) => run(spec, raw, ctx, (input) => spec.handler(input, ctx));
}
